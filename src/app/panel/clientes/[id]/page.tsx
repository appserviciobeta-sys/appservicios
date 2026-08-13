import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { eventosDe } from "@/lib/events";
import { cop, fecha, fechaHora, whatsapp } from "@/lib/format";
import {
  ESTADOS_CLIENTE,
  ESTADOS_SOLICITUD,
  ORDENES_COMPLETADAS,
  ORIGENES_CLIENTE,
  TIPOS_CLIENTE,
  etiqueta,
} from "@/lib/constants";
import {
  Aviso,
  Badge,
  Boton,
  Campo,
  Card,
  CardTitulo,
  Mensajes,
  Tabla,
  Td,
  Th,
  Vacio,
  claseInput,
  tonoEstado,
} from "@/components/ui";
import {
  actualizarCliente,
  agregarSede,
  cambiarEstadoCliente,
  guardarNotasCliente,
  recalcularReputacionCliente,
} from "../acciones";

export const dynamic = "force-dynamic";

export default async function ClienteDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const mensajes = await searchParams;

  const cliente = await prisma.client.findUnique({
    where: { id },
    include: {
      sedesB2B: { orderBy: { nombre: "asc" } },
      requests: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { serviceType: true, quotes: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
      ordenes: {
        orderBy: { createdAt: "desc" },
        include: { serviceType: true, professional: true, incidentes: true },
      },
    },
  });

  if (!cliente) notFound();

  const eventos = await eventosDe("Client", cliente.id);
  const completadas = cliente.ordenes.filter((o) => ORDENES_COMPLETADAS.includes(o.estado));
  const canceladas = cliente.ordenes.filter((o) => o.estado === "CANCELADA_CLIENTE");
  const facturado = completadas.reduce((acc, o) => acc + o.precioCliente, 0);
  const margen = completadas.reduce((acc, o) => acc + o.comision, 0);
  // Mismo criterio que el Trust del cliente: hay 3 días de gracia antes de
  // llamar impago a algo que quizá solo falta marcar en el panel.
  const GRACIA_MS = 3 * 24 * 3600 * 1000;
  const impagos = completadas.filter(
    (o) => o.estadoPago === "PENDIENTE" && Date.now() - o.updatedAt.getTime() > GRACIA_MS,
  );
  const incidentes = cliente.ordenes.flatMap((o) => o.incidentes);
  const esEmpresa = cliente.tipo === "EMPRESA";
  const ticketPromedio = completadas.length === 0 ? 0 : Math.round(facturado / completadas.length);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/panel/clientes" className="rotulo enlace hover:text-tinta">
          ← Clientes
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="titular text-3xl">{cliente.nombre}</h1>
          <Badge tono={tonoEstado(cliente.estado)}>{etiqueta(ESTADOS_CLIENTE, cliente.estado)}</Badge>
          <Badge tono={esEmpresa ? "acento" : "neutro"}>{etiqueta(TIPOS_CLIENTE, cliente.tipo)}</Badge>
        </div>
        <p className="mt-1 text-sm text-tinta-suave">
          {cliente.codigo} ·{" "}
          <a
            href={whatsapp(
              cliente.celular,
              `Hola ${cliente.nombre.split(" ")[0]}, te escribimos de la plataforma de servicios.`,
            )}
            target="_blank"
            rel="noreferrer"
            className="text-sello hover:underline"
          >
            {cliente.celular}
          </a>
          {cliente.email ? ` · ${cliente.email}` : ""} · cliente desde {fecha(cliente.createdAt)} ·{" "}
          {etiqueta(ORIGENES_CLIENTE, cliente.origen)}
        </p>
      </div>

      <Mensajes error={mensajes.error} ok={mensajes.ok} />

      {cliente.estado === "BLOQUEADO" ? (
        <Aviso tono="alerta">
          Cliente bloqueado: el formulario público rechaza sus solicitudes nuevas.
        </Aviso>
      ) : null}

      {!cliente.aceptaDatos ? (
        <Aviso tono="aviso">
          Este cliente no tiene consentimiento de datos registrado. Se creó antes de que existiera el
          checkbox o por un canal manual.
        </Aviso>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          {esEmpresa ? (
            <Card>
              <CardTitulo>Datos de la empresa</CardTitulo>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-tinta-suave">Razón social</div>
                  <div className="text-sm">{cliente.razonSocial || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-tinta-suave">NIT</div>
                  <div className="text-sm">{cliente.nit || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-tinta-suave">Contacto</div>
                  <div className="text-sm">
                    {cliente.contactoNombre || "—"}
                    {cliente.contactoCargo ? (
                      <span className="text-tinta-suave"> · {cliente.contactoCargo}</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-tinta-suave">Sedes declaradas</div>
                  <div className="text-sm">
                    {cliente.sedes} · {cliente.sedesB2B.length} registradas
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {esEmpresa ? (
            <Card>
              <CardTitulo>Sedes</CardTitulo>
              <div className="divide-y divide-regla">
                {cliente.sedesB2B.length === 0 ? (
                  <Vacio>Sin sedes registradas.</Vacio>
                ) : (
                  <ul className="divide-y divide-regla">
                    {cliente.sedesB2B.map((sede) => (
                      <li key={sede.id} className="flex flex-wrap justify-between gap-3 px-4 py-3">
                        <div>
                          <div className="text-sm font-medium">{sede.nombre}</div>
                          <div className="text-xs text-tinta-suave">
                            {sede.direccion}
                            {sede.zona ? ` · ${sede.zona}` : ""}
                          </div>
                        </div>
                        {sede.contacto ? (
                          <div className="text-xs text-tinta-suave">
                            {sede.contacto} {sede.celular}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                <form action={agregarSede} className="grid gap-3 p-4 sm:grid-cols-2">
                  <input type="hidden" name="clientId" value={cliente.id} />
                  <Campo etiqueta="Nombre de la sede">
                    <input name="nombre" className={claseInput} placeholder="Sede Norte" />
                  </Campo>
                  <Campo etiqueta="Dirección">
                    <input name="direccion" className={claseInput} />
                  </Campo>
                  <Campo etiqueta="Zona">
                    <input name="zona" className={claseInput} />
                  </Campo>
                  <Campo etiqueta="Contacto en sitio">
                    <input name="contacto" className={claseInput} />
                  </Campo>
                  <Campo etiqueta="Celular de la sede">
                    <input name="celular" className={claseInput} inputMode="tel" />
                  </Campo>
                  <div className="flex items-end">
                    <Boton tipo="secundario">Agregar sede</Boton>
                  </div>
                </form>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardTitulo>Solicitudes</CardTitulo>
            {cliente.requests.length === 0 ? (
              <Vacio>Este cliente todavía no ha pedido nada.</Vacio>
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Servicio</Th>
                    <Th>Fecha</Th>
                    <Th>Estado</Th>
                    <Th right>Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {cliente.requests.map((solicitud) => (
                    <tr key={solicitud.id}>
                      <Td>
                        <Link
                          href={`/panel/solicitudes/${solicitud.id}`}
                          className="text-sello hover:underline"
                        >
                          {solicitud.codigo}
                        </Link>
                      </Td>
                      <Td>{solicitud.serviceType?.nombre ?? "Sin clasificar"}</Td>
                      <Td className="text-tinta-suave">{fecha(solicitud.createdAt)}</Td>
                      <Td>
                        <Badge tono={tonoEstado(solicitud.estado)}>
                          {etiqueta(ESTADOS_SOLICITUD, solicitud.estado)}
                        </Badge>
                        {solicitud.motivoPerdida ? (
                          <div className="text-xs text-tinta-suave">{solicitud.motivoPerdida}</div>
                        ) : null}
                      </Td>
                      <Td right className="cifra">
                        {solicitud.quotes[0] ? cop(solicitud.quotes[0].precioTotal) : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Card>

          <Card>
            <CardTitulo>Servicios</CardTitulo>
            {cliente.ordenes.length === 0 ? (
              <Vacio>Sin servicios ejecutados.</Vacio>
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Servicio</Th>
                    <Th>Profesional</Th>
                    <Th>Estado</Th>
                    <Th>Pago</Th>
                    <Th right>Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {cliente.ordenes.map((orden) => (
                    <tr key={orden.id}>
                      <Td>
                        <Link
                          href={`/panel/servicios/${orden.id}`}
                          className="text-sello hover:underline"
                        >
                          {orden.codigo}
                        </Link>
                      </Td>
                      <Td>{orden.serviceType.nombre}</Td>
                      <Td>{orden.professional?.nombre ?? "—"}</Td>
                      <Td>
                        <Badge tono={tonoEstado(orden.estado)}>{orden.estado}</Badge>
                      </Td>
                      <Td>
                        <Badge tono={tonoEstado(orden.estadoPago)}>{orden.estadoPago}</Badge>
                      </Td>
                      <Td right className="cifra">
                        {cop(orden.precioCliente)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Card>

          <Card>
            <CardTitulo>Datos de contacto</CardTitulo>
            <form action={actualizarCliente} className="grid gap-4 p-4 sm:grid-cols-2">
              <input type="hidden" name="clientId" value={cliente.id} />
              <Campo etiqueta="Nombre">
                <input name="nombre" className={claseInput} defaultValue={cliente.nombre} />
              </Campo>
              <Campo etiqueta="Correo">
                <input name="email" className={claseInput} defaultValue={cliente.email} />
              </Campo>
              <Campo etiqueta="Zona">
                <input name="zona" className={claseInput} defaultValue={cliente.zona} />
              </Campo>
              <Campo etiqueta="Dirección">
                <input name="direccion" className={claseInput} defaultValue={cliente.direccion} />
              </Campo>
              <div className="sm:col-span-2">
                <Boton tipo="secundario">Guardar datos</Boton>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitulo
              accion={<span className="cifra text-2xl font-semibold">{cliente.trustScore}</span>}
            >
              Reputación
            </CardTitulo>
            <div className="space-y-2 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-tinta-suave">Servicios completados</span>
                <span className="cifra">{completadas.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Cancelados por él</span>
                <span className={`cifra ${canceladas.length > 0 ? "text-aviso" : ""}`}>
                  {canceladas.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Incidentes</span>
                <span className="cifra">{incidentes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Servicios sin cobrar</span>
                <span className={`cifra ${impagos.length > 0 ? "text-alerta" : ""}`}>
                  {impagos.length}
                </span>
              </div>
              <form action={recalcularReputacionCliente} className="pt-2">
                <input type="hidden" name="clientId" value={cliente.id} />
                <Boton tipo="secundario" className="w-full !py-1 !text-xs">
                  Recalcular
                </Boton>
              </form>
            </div>
          </Card>

          <Card>
            <CardTitulo>Valor del cliente</CardTitulo>
            <div className="space-y-2 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-tinta-suave">Facturado</span>
                <span className="cifra font-medium">{cop(facturado)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Margen generado</span>
                <span className="cifra">{cop(margen)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Ticket promedio</span>
                <span className="cifra">{cop(ticketPromedio)}</span>
              </div>
              <p className="pt-2 text-xs text-tinta-suave">
                Un cliente que repite vale mucho más que uno nuevo: aquí se ve cuál es cuál.
              </p>
            </div>
          </Card>

          <Card>
            <CardTitulo>Estado de la cuenta</CardTitulo>
            <form action={cambiarEstadoCliente} className="space-y-3 p-4">
              <input type="hidden" name="clientId" value={cliente.id} />
              <select name="estado" className={claseInput} defaultValue={cliente.estado}>
                {Object.entries(ESTADOS_CLIENTE).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
              <input
                name="motivo"
                className={claseInput}
                placeholder="Motivo (obligatorio para bloquear)"
              />
              <Boton tipo="secundario" className="w-full">
                Cambiar estado
              </Boton>
            </form>
          </Card>

          <Card>
            <CardTitulo>Notas internas</CardTitulo>
            <form action={guardarNotasCliente} className="space-y-3 p-4">
              <input type="hidden" name="clientId" value={cliente.id} />
              <textarea
                name="notasInternas"
                rows={5}
                className={claseInput}
                defaultValue={cliente.notasInternas}
              />
              <Boton tipo="secundario" className="w-full">
                Guardar
              </Boton>
            </form>
          </Card>

          <Card>
            <CardTitulo>Bitácora</CardTitulo>
            {eventos.length === 0 ? (
              <Vacio>Sin eventos.</Vacio>
            ) : (
              <ul className="divide-y divide-regla">
                {eventos.slice(0, 8).map((evento) => (
                  <li key={evento.id} className="px-4 py-2.5 text-sm">
                    <div className="font-medium">{evento.tipo}</div>
                    <div className="text-xs text-tinta-suave">{fechaHora(evento.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
