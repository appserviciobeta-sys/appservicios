import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { eventosDe } from "@/lib/events";
import { urlDeEvidencia, urlsDeEvidencia } from "@/lib/almacenamiento";
import { cop, fecha, fechaHora, minutosATexto, whatsapp } from "@/lib/format";
import {
  ESTADOS_ORDEN,
  ESTADOS_PAGO,
  ORDENES_ACTIVAS,
  SEVERIDADES,
  TIPOS_INCIDENTE,
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
  Vacio,
  claseInput,
  tonoEstado,
} from "@/components/ui";
import {
  abrirIncidente,
  agregarEvidencia,
  agregarMaterial,
  calificar,
  cambiarEstadoOrden,
  cambiarEstadoPago,
  crearCambioAlcance,
  generarEnlacesPuerta,
  registrarCheckIn,
  registrarCheckOut,
  resolverCambioAlcance,
  solicitarReemplazo,
} from "../acciones";

export const dynamic = "force-dynamic";

/// Dominio público del piloto. En despliegue se toma de la variable de entorno;
/// en local queda el host de desarrollo para poder probar desde el celular.
const enlaceBase = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";

export default async function ServicioDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const mensajes = await searchParams;

  const orden = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      client: true,
      professional: true,
      serviceType: true,
      request: true,
      quote: { include: { lineas: { orderBy: { orden: "asc" } } } },
      cambiosAlcance: { orderBy: { solicitadoAt: "desc" } },
      materiales: true,
      evidencias: { orderBy: { createdAt: "desc" } },
      calificaciones: true,
      incidentes: { orderBy: { abiertoAt: "desc" } },
      reemplazos: { include: { profesionalSaliente: true, profesionalEntrante: true } },
    },
  });

  if (!orden) notFound();

  const eventos = await eventosDe("ServiceOrder", orden.id);
  const cambiosPendientes = orden.cambiosAlcance.filter((c) => c.estado === "SOLICITADO");
  // Bucket privado: se firma cada enlace en el momento de mostrar la página.
  const cambios = await Promise.all(
    orden.cambiosAlcance.map(async (c) => ({ ...c, urlFoto: await urlDeEvidencia(c.fotoUrl) })),
  );
  const evidencias = await urlsDeEvidencia(orden.evidencias);
  const calificacionCliente = orden.calificaciones.find((c) => c.emisor === "CLIENTE");
  const costoMateriales = orden.materiales.reduce(
    (acc, m) => acc + m.precioUnitario * m.cantidad,
    0,
  );
  const margen = orden.comision - costoMateriales;
  const enCurso = ORDENES_ACTIVAS.includes(orden.estado);
  const duracionReal =
    orden.checkInAt && orden.checkOutAt
      ? Math.round((orden.checkOutAt.getTime() - orden.checkInAt.getTime()) / 60000)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/panel/servicios" className="rotulo enlace hover:text-tinta">
          ← Servicios
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="titular text-3xl">{orden.codigo}</h1>
          <Badge tono={tonoEstado(orden.estado)}>{etiqueta(ESTADOS_ORDEN, orden.estado)}</Badge>
          <Badge tono={tonoEstado(orden.estadoPago)}>
            Pago: {etiqueta(ESTADOS_PAGO, orden.estadoPago)}
          </Badge>
          {orden.garantiaHasta ? (
            <Badge tono="ok">Garantía hasta {fecha(orden.garantiaHasta)}</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-tinta-suave">
          {orden.serviceType.nombre} · solicitud{" "}
          <Link href={`/panel/solicitudes/${orden.requestId}`} className="text-sello hover:underline">
            {orden.request.codigo}
          </Link>
        </p>
      </div>

      <Mensajes error={mensajes.error} ok={mensajes.ok} />

      {cambiosPendientes.length > 0 ? (
        <Aviso tono="aviso">
          Hay {cambiosPendientes.length} cambio(s) de alcance esperando respuesta del cliente. El
          trabajo adicional no debe ejecutarse hasta que apruebe.
        </Aviso>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardTitulo>Ficha del servicio</CardTitulo>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-tinta-suave">Cliente</div>
                <Link
                  href={`/panel/clientes/${orden.clientId}`}
                  className="text-sm font-medium text-sello hover:underline"
                >
                  {orden.client.nombre}
                </Link>
                <div className="text-sm text-tinta-suave">{orden.client.celular}</div>
              </div>
              <div>
                <div className="text-xs text-tinta-suave">Profesional</div>
                {orden.professional ? (
                  <>
                    <Link
                      href={`/panel/profesionales/${orden.professionalId}`}
                      className="text-sm font-medium text-sello hover:underline"
                    >
                      {orden.professional.nombre}
                    </Link>
                    <div className="text-sm text-tinta-suave">{orden.professional.celular}</div>
                  </>
                ) : (
                  <div className="text-sm text-alerta">Sin asignar</div>
                )}
              </div>
              <div>
                <div className="text-xs text-tinta-suave">Dirección</div>
                <div className="text-sm">
                  {orden.request.direccion} · {orden.request.zona}
                </div>
              </div>
              <div>
                <div className="text-xs text-tinta-suave">Programado</div>
                <div className="text-sm">
                  {orden.programadoPara ? fechaHora(orden.programadoPara) : "Sin fecha fija"}
                </div>
              </div>
              <div>
                <div className="text-xs text-tinta-suave">Check-in</div>
                <div className="text-sm">{fechaHora(orden.checkInAt)}</div>
              </div>
              <div>
                <div className="text-xs text-tinta-suave">Check-out</div>
                <div className="text-sm">
                  {fechaHora(orden.checkOutAt)}
                  {duracionReal !== null ? (
                    <span className="text-tinta-suave"> · {minutosATexto(duracionReal)}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-t border-regla p-4">
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <div className="rotulo">Código que tiene el cliente</div>
                  <div className="cifra text-2xl font-semibold tracking-widest">
                    {orden.codigoServicio}
                  </div>
                </div>
                <div>
                  <div className="rotulo">Palabra del profesional</div>
                  <div className="cifra text-lg tracking-widest text-sello">
                    {orden.palabraSeguridad || "—"}
                  </div>
                </div>
                {!orden.checkInAt && enCurso ? (
                  <form action={registrarCheckIn} className="flex items-end gap-2">
                    <input type="hidden" name="ordenId" value={orden.id} />
                    <Campo etiqueta="Código que dictó el cliente">
                      <input
                        name="codigo"
                        className={`${claseInput} !w-32`}
                        inputMode="numeric"
                        maxLength={4}
                        required
                      />
                    </Campo>
                    <Boton>Registrar check-in</Boton>
                  </form>
                ) : null}
                {orden.checkInAt && !orden.checkOutAt ? (
                  <form action={registrarCheckOut}>
                    <input type="hidden" name="ordenId" value={orden.id} />
                    <Boton>Registrar check-out</Boton>
                  </form>
                ) : null}
              </div>
              {!orden.checkInAt ? (
                <p className="mt-3 text-xs text-tinta-suave">
                  El profesional debe pedir este código antes de empezar. Si no coincide, no inicia.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardTitulo>Cambios de alcance</CardTitulo>
            <div className="divide-y divide-regla">
              {orden.cambiosAlcance.length === 0 ? (
                <Vacio>Sin cambios de alcance.</Vacio>
              ) : (
                cambios.map((cambio) => (
                  <div key={cambio.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-lg">
                        <p className="text-sm">{cambio.descripcion}</p>
                        <div className="mt-1 text-xs text-tinta-suave">
                          {fechaHora(cambio.solicitadoAt)}
                          {cambio.minutosAdicionales > 0
                            ? ` · +${minutosATexto(cambio.minutosAdicionales)}`
                            : ""}
                          {cambio.urlFoto ? (
                            <>
                              {" · "}
                              <a
                                href={cambio.urlFoto}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sello hover:underline"
                              >
                                ver foto
                              </a>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="cifra font-semibold">+{cop(cambio.precioAdicional)}</div>
                        <Badge tono={tonoEstado(cambio.estado)}>{cambio.estado}</Badge>
                      </div>
                    </div>

                    {cambio.estado === "SOLICITADO" ? (
                      <div className="mt-3 flex gap-2">
                        <form action={resolverCambioAlcance}>
                          <input type="hidden" name="cambioId" value={cambio.id} />
                          <input type="hidden" name="estado" value="APROBADO" />
                          <Boton className="!py-1.5 !text-xs">Cliente aprobó</Boton>
                        </form>
                        <form action={resolverCambioAlcance}>
                          <input type="hidden" name="cambioId" value={cambio.id} />
                          <input type="hidden" name="estado" value="RECHAZADO" />
                          <Boton tipo="secundario" className="!py-1.5 !text-xs">
                            Cliente rechazó
                          </Boton>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))
              )}

              {enCurso ? (
                <form action={crearCambioAlcance} className="space-y-3 p-4">
                  <input type="hidden" name="ordenId" value={orden.id} />
                  <Campo
                    etiqueta="Nuevo trabajo adicional"
                    ayuda="Lo que el profesional encontró y no estaba en el alcance original."
                  >
                    <textarea name="descripcion" rows={2} className={claseInput} required />
                  </Campo>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Campo etiqueta="Valor adicional (COP)">
                      <input name="precioAdicional" type="number" min={0} className={claseInput} />
                    </Campo>
                    <Campo etiqueta="Minutos extra">
                      <input name="minutosAdicionales" type="number" min={0} className={claseInput} />
                    </Campo>
                    <Campo etiqueta="URL de la foto">
                      <input name="fotoUrl" className={claseInput} />
                    </Campo>
                  </div>
                  <Boton tipo="secundario">Enviar al cliente para aprobación</Boton>
                </form>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardTitulo>Materiales</CardTitulo>
            <div className="divide-y divide-regla">
              {orden.materiales.length === 0 ? (
                <Vacio>Sin materiales registrados.</Vacio>
              ) : (
                <ul className="p-4">
                  {orden.materiales.map((material) => (
                    <li key={material.id} className="flex justify-between gap-3 py-1 text-sm">
                      <span>
                        {material.descripcion}
                        <span className="text-tinta-suave">
                          {" "}
                          × {material.cantidad}
                          {material.proveedor ? ` · ${material.proveedor}` : ""}
                        </span>
                      </span>
                      <span className="cifra">
                        {cop(material.precioUnitario * material.cantidad)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form action={agregarMaterial} className="grid gap-3 p-4 sm:grid-cols-4">
                <input type="hidden" name="ordenId" value={orden.id} />
                <Campo etiqueta="Material">
                  <input name="descripcion" className={claseInput} />
                </Campo>
                <Campo etiqueta="Cantidad">
                  <input
                    name="cantidad"
                    type="number"
                    step="0.5"
                    defaultValue={1}
                    className={claseInput}
                  />
                </Campo>
                <Campo etiqueta="Precio unitario">
                  <input name="precioUnitario" type="number" min={0} className={claseInput} />
                </Campo>
                <Campo etiqueta="Proveedor">
                  <input name="proveedor" className={claseInput} />
                </Campo>
                <div className="sm:col-span-4">
                  <Boton tipo="secundario">Agregar material</Boton>
                </div>
              </form>
            </div>
          </Card>

          <Card>
            <CardTitulo>Evidencia</CardTitulo>
            <div className="divide-y divide-regla">
              {orden.evidencias.length === 0 ? (
                <Vacio>Sin evidencia registrada.</Vacio>
              ) : (
                <ul className="divide-y divide-regla">
                  {evidencias.map((evidencia) => (
                    <li key={evidencia.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Badge>{evidencia.tipo}</Badge>
                        <span className="text-xs text-tinta-suave">
                          {fechaHora(evidencia.createdAt)}
                        </span>
                      </div>
                      {evidencia.nota ? <p className="mt-1 text-sm">{evidencia.nota}</p> : null}
                      {evidencia.urlVista ? (
                        <a
                          href={evidencia.urlVista}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-sello hover:underline"
                        >
                          Ver archivo
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <form action={agregarEvidencia} className="grid gap-3 p-4 sm:grid-cols-[8rem_1fr_1fr]">
                <input type="hidden" name="ordenId" value={orden.id} />
                <Campo etiqueta="Tipo">
                  <select name="tipo" className={claseInput}>
                    <option value="ANTES">Antes</option>
                    <option value="DESPUES">Después</option>
                    <option value="INCIDENTE">Incidente</option>
                    <option value="DOCUMENTO">Documento</option>
                  </select>
                </Campo>
                <Campo etiqueta="Nota">
                  <input name="nota" className={claseInput} />
                </Campo>
                <Campo etiqueta="URL">
                  <input name="url" className={claseInput} />
                </Campo>
                <div className="sm:col-span-3">
                  <Boton tipo="secundario">Registrar evidencia</Boton>
                </div>
              </form>
            </div>
          </Card>

          <Card>
            <CardTitulo>Calificación del cliente</CardTitulo>
            {calificacionCliente ? (
              <div className="p-4">
                <div className="flex flex-wrap gap-6 text-sm">
                  <span>
                    Calidad: <strong>{calificacionCliente.calidad ?? "—"}/5</strong>
                  </span>
                  <span>
                    Puntualidad: <strong>{calificacionCliente.puntualidad ?? "—"}/5</strong>
                  </span>
                  <span>
                    Comunicación: <strong>{calificacionCliente.comunicacion ?? "—"}/5</strong>
                  </span>
                </div>
                {calificacionCliente.comentario ? (
                  <p className="mt-2 rounded-lg bg-papel-hondo p-3 text-sm italic">
                    “{calificacionCliente.comentario}”
                  </p>
                ) : null}
              </div>
            ) : (
              <form action={calificar} className="grid gap-3 p-4 sm:grid-cols-3">
                <input type="hidden" name="ordenId" value={orden.id} />
                <input type="hidden" name="emisor" value="CLIENTE" />
                {[
                  { name: "calidad", etiqueta: "Calidad" },
                  { name: "puntualidad", etiqueta: "Puntualidad" },
                  { name: "comunicacion", etiqueta: "Comunicación" },
                ].map((campo) => (
                  <Campo key={campo.name} etiqueta={campo.etiqueta}>
                    <select name={campo.name} className={claseInput} defaultValue="5">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Campo>
                ))}
                <div className="sm:col-span-3">
                  <Campo etiqueta="Comentario">
                    <textarea name="comentario" rows={2} className={claseInput} />
                  </Campo>
                </div>
                <div className="sm:col-span-3">
                  <Boton tipo="secundario">Guardar calificación</Boton>
                </div>
              </form>
            )}
          </Card>

          <Card>
            <CardTitulo>Incidentes</CardTitulo>
            <div className="divide-y divide-regla">
              {orden.incidentes.length === 0 ? (
                <Vacio>Sin incidentes.</Vacio>
              ) : (
                orden.incidentes.map((incidente) => (
                  <div key={incidente.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{incidente.codigo}</span>
                      <Badge tono={incidente.severidad === "ALTO" ? "alerta" : "aviso"}>
                        {etiqueta(SEVERIDADES, incidente.severidad)}
                      </Badge>
                      <Badge>{etiqueta(TIPOS_INCIDENTE, incidente.tipo)}</Badge>
                      <Badge tono={tonoEstado(incidente.estado)}>{incidente.estado}</Badge>
                    </div>
                    <p className="mt-2 text-sm">{incidente.descripcion}</p>
                  </div>
                ))
              )}

              <form action={abrirIncidente} className="grid gap-3 p-4 sm:grid-cols-3">
                <input type="hidden" name="ordenId" value={orden.id} />
                <Campo etiqueta="Tipo">
                  <select name="tipo" className={claseInput}>
                    {Object.entries(TIPOS_INCIDENTE).map(([valor, texto]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Severidad">
                  <select name="severidad" className={claseInput} defaultValue="BAJO">
                    {Object.entries(SEVERIDADES).map(([valor, texto]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Reportado por">
                  <select name="reportadoPor" className={claseInput}>
                    <option value="CLIENTE">Cliente</option>
                    <option value="PROFESIONAL">Profesional</option>
                    <option value="PLATAFORMA">Plataforma</option>
                  </select>
                </Campo>
                <div className="sm:col-span-3">
                  <Campo etiqueta="Qué pasó">
                    <textarea name="descripcion" rows={2} className={claseInput} />
                  </Campo>
                </div>
                <div className="sm:col-span-3">
                  <Boton tipo="peligro">Abrir incidente</Boton>
                </div>
              </form>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitulo>Economía del servicio</CardTitulo>
            <div className="space-y-2 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-tinta-suave">Cobro al cliente</span>
                <span className="cifra font-medium">{cop(orden.precioCliente)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Pago al profesional</span>
                <span className="cifra">−{cop(orden.pagoProfesional)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-suave">Materiales</span>
                <span className="cifra">−{cop(costoMateriales)}</span>
              </div>
              <div className="flex justify-between border-t border-regla pt-2 font-semibold">
                <span>Margen bruto</span>
                <span className={`cifra ${margen < 0 ? "text-alerta" : ""}`}>{cop(margen)}</span>
              </div>
              <p className="pt-2 text-xs text-tinta-suave">
                Sin descontar pasarela, soporte ni reserva de garantía. Es margen bruto, no utilidad.
              </p>
            </div>
          </Card>

          <Card>
            <CardTitulo>Enlaces de la puerta</CardTitulo>
            <div className="space-y-4 p-4 text-sm">
              {orden.tokenProfesional && orden.tokenCliente ? (
                <>
                  <div>
                    <div className="rotulo">Para el profesional</div>
                    <p className="mt-1 text-xs text-tinta-media">
                      Ficha del trabajo, palabra de seguridad, fotos y cierre.
                    </p>
                    {orden.professional ? (
                      <a
                        href={whatsapp(
                          orden.professional.celular,
                          `Hola ${orden.professional.nombre.split(" ")[0]}, este es tu trabajo ${orden.codigo}. Abre este enlace cuando salgas: ${enlaceBase}/t/${orden.tokenProfesional}`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="rotulo enlace mt-2 inline-block text-sello"
                      >
                        Enviar por WhatsApp →
                      </a>
                    ) : null}
                    <code className="mt-2 block truncate text-xs text-tinta-suave">
                      /t/{orden.tokenProfesional}
                    </code>
                  </div>

                  <div className="border-t border-regla pt-4">
                    <div className="rotulo">Para el cliente</div>
                    <p className="mt-1 text-xs text-tinta-media">
                      Quién va a entrar, código, aprobación de adicionales y confirmación.
                    </p>
                    <a
                      href={whatsapp(
                        orden.client.celular,
                        `Hola ${orden.client.nombre.split(" ")[0]}, sigue tu servicio ${orden.codigo} aquí: ${enlaceBase}/s/${orden.tokenCliente}`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="rotulo enlace mt-2 inline-block text-sello"
                    >
                      Enviar por WhatsApp →
                    </a>
                    <code className="mt-2 block truncate text-xs text-tinta-suave">
                      /s/{orden.tokenCliente}
                    </code>
                  </div>
                </>
              ) : (
                <p className="text-tinta-media">
                  Este servicio se creó antes de los enlaces de la puerta.
                </p>
              )}

              <form action={generarEnlacesPuerta} className="border-t border-regla pt-4">
                <input type="hidden" name="ordenId" value={orden.id} />
                <Boton tipo="secundario" className="w-full !py-1.5 !text-[0.625rem]">
                  {orden.tokenProfesional ? "Rotar enlaces" : "Generar enlaces"}
                </Boton>
                <p className="mt-2 text-xs text-tinta-suave">
                  Rotar invalida los anteriores. Úsalo si un enlace se compartió por error.
                </p>
              </form>
            </div>
          </Card>

          <Card>
            <CardTitulo>Operación</CardTitulo>
            <div className="space-y-4 p-4">
              <form action={cambiarEstadoOrden} className="space-y-2">
                <input type="hidden" name="ordenId" value={orden.id} />
                <select name="estado" className={claseInput} defaultValue={orden.estado}>
                  {Object.entries(ESTADOS_ORDEN).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
                <Boton tipo="secundario" className="w-full">
                  Cambiar estado
                </Boton>
              </form>

              <form action={cambiarEstadoPago} className="space-y-2 border-t border-regla pt-4">
                <input type="hidden" name="ordenId" value={orden.id} />
                <select name="estadoPago" className={claseInput} defaultValue={orden.estadoPago}>
                  {Object.entries(ESTADOS_PAGO).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
                <Boton tipo="secundario" className="w-full">
                  Actualizar pago
                </Boton>
              </form>

              {orden.professional ? (
                <a
                  href={whatsapp(
                    orden.professional.celular,
                    `Hola ${orden.professional.nombre.split(" ")[0]}, sobre el servicio ${orden.codigo}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-t border-regla pt-4 text-sm text-sello hover:underline"
                >
                  Escribir al profesional →
                </a>
              ) : null}
            </div>
          </Card>

          {enCurso ? (
            <Card>
              <CardTitulo>Reemplazo</CardTitulo>
              <form action={solicitarReemplazo} className="space-y-3 p-4">
                <input type="hidden" name="ordenId" value={orden.id} />
                <select name="motivo" className={claseInput} required>
                  <option value="">Motivo…</option>
                  <option value="CANCELO">El profesional canceló</option>
                  <option value="NO_APARECIO">No apareció</option>
                  <option value="NO_PUEDE_CONTINUAR">No puede continuar</option>
                  <option value="CLIENTE_PIDIO">El cliente pidió cambio</option>
                </select>
                <Boton tipo="peligro" className="w-full">
                  Activar reemplazo
                </Boton>
                <p className="text-xs text-tinta-suave">
                  Cancela este servicio, reabre la solicitud y recalcula candidatos de inmediato.
                </p>
              </form>
            </Card>
          ) : null}

          {orden.reemplazos.length > 0 ? (
            <Card>
              <CardTitulo>Reemplazos</CardTitulo>
              <ul className="divide-y divide-regla">
                {orden.reemplazos.map((reemplazo) => (
                  <li key={reemplazo.id} className="px-4 py-2.5 text-sm">
                    <div>{reemplazo.motivo}</div>
                    <div className="text-xs text-tinta-suave">
                      {reemplazo.profesionalSaliente?.nombre ?? "—"} →{" "}
                      {reemplazo.profesionalEntrante?.nombre ?? "pendiente"}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardTitulo>Bitácora</CardTitulo>
            {eventos.length === 0 ? (
              <Vacio>Sin eventos.</Vacio>
            ) : (
              <ul className="divide-y divide-regla">
                {eventos.map((evento) => (
                  <li key={evento.id} className="px-4 py-2.5 text-sm">
                    <div className="font-medium">{evento.tipo}</div>
                    <div className="text-xs text-tinta-suave">
                      {fechaHora(evento.createdAt)} · {evento.actor}
                    </div>
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
