import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { eventosDe } from "@/lib/events";
import { cop, fechaHora, haceCuanto, minutosATexto, whatsapp } from "@/lib/format";
import { ESTADOS_MATCH, ESTADOS_SOLICITUD, URGENCIAS, etiqueta } from "@/lib/constants";
import { precioFueraDeRango } from "@/lib/price-engine";
import type { FactorMatch } from "@/lib/match-engine";
import { CAMPOS } from "@/lib/campos";
import {
  Aviso,
  Badge,
  Barra,
  Boton,
  Card,
  CardTitulo,
  Mensajes,
  Vacio,
  claseInput,
  tonoEstado,
} from "@/components/ui";
import {
  actualizarCandidato,
  asignarProfesional,
  buscarCandidatos,
  guardarNotas,
  marcarPerdida,
} from "../acciones";

export const dynamic = "force-dynamic";

export default async function SolicitudDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const mensajes = await searchParams;

  const solicitud = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      client: true,
      category: true,
      serviceType: true,
      quotes: { orderBy: { createdAt: "desc" }, include: { lineas: { orderBy: { orden: "asc" } } } },
      ordenes: true,
      candidatos: { orderBy: [{ estado: "asc" }, { score: "desc" }], include: { professional: true } },
    },
  });

  if (!solicitud) notFound();

  const cotizacion = solicitud.quotes[0];
  const eventos = await eventosDe("ServiceRequest", solicitud.id);
  const respuestas = JSON.parse(solicitud.respuestas || "{}") as Record<string, unknown>;
  const elegibles = solicitud.candidatos.filter((c) => c.estado !== "DESCARTADO");
  const descartados = solicitud.candidatos.filter((c) => c.estado === "DESCARTADO");
  const ordenActiva = solicitud.ordenes.find((o) => !o.estado.startsWith("CANCELADA"));
  const fueraDeRango =
    cotizacion && solicitud.serviceType
      ? precioFueraDeRango(solicitud.serviceType, cotizacion.precioTotal)
      : false;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/panel/solicitudes" className="rotulo enlace hover:text-tinta">
          ← Solicitudes
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="titular text-3xl">{solicitud.codigo}</h1>
          <Badge tono={tonoEstado(solicitud.estado)}>
            {etiqueta(ESTADOS_SOLICITUD, solicitud.estado)}
          </Badge>
          <Badge>{etiqueta(URGENCIAS, solicitud.urgencia)}</Badge>
          {solicitud.riesgo !== "BAJO" ? (
            <Badge tono={solicitud.riesgo === "ALTO" ? "alerta" : "aviso"}>
              Riesgo {solicitud.riesgo.toLowerCase()}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-tinta-suave">
          Creada {haceCuanto(solicitud.createdAt)} · canal {solicitud.canal}
        </p>
      </div>

      <Mensajes error={mensajes.error} ok={mensajes.ok} />

      {ordenActiva ? (
        <Aviso tono="ok">
          Esta solicitud ya tiene el servicio{" "}
          <Link href={`/panel/servicios/${ordenActiva.id}`} className="underline">
            {ordenActiva.codigo}
          </Link>
          .
        </Aviso>
      ) : null}

      {fueraDeRango ? (
        <Aviso tono="aviso">
          El precio cotizado está muy lejos del precio base del servicio. Revisa el cuestionario
          antes de confirmarle al cliente.
        </Aviso>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardTitulo>Qué pidió el cliente</CardTitulo>
            <div className="space-y-4 p-4">
              <div>
                <div className="text-xs text-tinta-suave">Servicio</div>
                <div className="font-medium">
                  {solicitud.serviceType?.nombre ?? "Sin clasificar"}
                  {solicitud.category ? (
                    <span className="text-tinta-suave"> · {solicitud.category.nombre}</span>
                  ) : null}
                </div>
              </div>

              {solicitud.textoCliente ? (
                <div>
                  <div className="text-xs text-tinta-suave">En sus palabras</div>
                  <p className="mt-1 rounded-lg bg-papel-hondo p-3 text-sm italic">
                    “{solicitud.textoCliente}”
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-tinta-suave">Cuándo</div>
                  <div className="text-sm">
                    {etiqueta(URGENCIAS, solicitud.urgencia)}
                    {solicitud.fechaDeseada ? ` · ${fechaHora(solicitud.fechaDeseada)}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-tinta-suave">Dónde</div>
                  <div className="text-sm">
                    {solicitud.direccion || "—"}
                    {solicitud.zona ? ` · ${solicitud.zona}` : ""}
                  </div>
                </div>
              </div>

              {Object.keys(respuestas).length > 0 ? (
                <div>
                  <div className="text-xs text-tinta-suave">Respuestas del cuestionario</div>
                  <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                    {Object.entries(respuestas).map(([clave, valor]) => (
                      <li key={clave} className="flex justify-between gap-3 text-sm">
                        <span className="text-tinta-suave">{CAMPOS[clave]?.etiqueta ?? clave}</span>
                        <span>
                          {typeof valor === "string" || typeof valor === "number"
                            ? String(valor)
                            : JSON.stringify(valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardTitulo
              accion={
                cotizacion ? (
                  <span className="text-xs text-tinta-suave">
                    {minutosATexto(cotizacion.duracionEstimadaMin)} estimados
                  </span>
                ) : null
              }
            >
              Cotización
            </CardTitulo>
            {cotizacion ? (
              <div className="p-4">
                <ul className="space-y-2">
                  {cotizacion.lineas.map((linea) => (
                    <li key={linea.id} className="flex justify-between gap-3 text-sm">
                      <span className="text-tinta-suave">{linea.etiqueta}</span>
                      <span className="cifra">{cop(linea.monto)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-regla pt-3 font-semibold">
                  <span>Total al cliente</span>
                  <span className="cifra">{cop(cotizacion.precioTotal)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-papel-hondo p-3 text-sm">
                  <div>
                    <div className="text-xs text-tinta-suave">Paga al profesional</div>
                    <div className="cifra font-medium">{cop(cotizacion.precioProfesional)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-tinta-suave">Comisión plataforma</div>
                    <div className="cifra font-medium">
                      {cop(cotizacion.comision)}{" "}
                      <span className="text-xs font-normal text-tinta-suave">
                        ({((cotizacion.comision / cotizacion.precioTotal) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Vacio>Sin cotización generada.</Vacio>
            )}
          </Card>

          <Card>
            <CardTitulo
              accion={
                !ordenActiva ? (
                  <form action={buscarCandidatos}>
                    <input type="hidden" name="requestId" value={solicitud.id} />
                    <Boton tipo="secundario" className="!py-1 !text-xs">
                      {solicitud.candidatos.length > 0 ? "Recalcular" : "Buscar profesionales"}
                    </Boton>
                  </form>
                ) : null
              }
            >
              Candidatos
            </CardTitulo>

            {solicitud.candidatos.length === 0 ? (
              <Vacio>
                Todavía no se ha corrido el matching. El motor evalúa habilidades verificadas, zona,
                historial en este servicio, puntualidad y carga.
              </Vacio>
            ) : (
              <div className="divide-y divide-regla">
                {elegibles.map((candidato) => {
                  const factores = JSON.parse(candidato.desglose || "[]") as FactorMatch[];
                  return (
                    <div key={candidato.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/panel/profesionales/${candidato.professionalId}`}
                            className="font-medium text-sello hover:underline"
                          >
                            {candidato.professional.nombre}
                          </Link>
                          <div className="mt-0.5 text-xs text-tinta-suave">
                            {candidato.professional.nivel} · Trust{" "}
                            {candidato.professional.trustScore} ·{" "}
                            <a
                              href={whatsapp(
                                candidato.professional.celular,
                                `Hola ${candidato.professional.nombre.split(" ")[0]}, tenemos un servicio de ${solicitud.serviceType?.nombre} en ${solicitud.zona}. ¿Puedes tomarlo?`,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sello hover:underline"
                            >
                              WhatsApp
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="cifra text-xl font-semibold">{candidato.score}</div>
                            <div className="text-xs text-tinta-suave">match</div>
                          </div>
                          <Badge tono={tonoEstado(candidato.estado)}>
                            {etiqueta(ESTADOS_MATCH, candidato.estado)}
                          </Badge>
                        </div>
                      </div>

                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {factores.map((factor) => (
                          <li key={factor.clave}>
                            <div className="flex justify-between gap-2 text-xs">
                              <span className="text-tinta-suave">{factor.etiqueta}</span>
                              <span className="cifra">
                                {factor.puntos}
                                {factor.maximo > 0 ? `/${factor.maximo}` : ""}
                              </span>
                            </div>
                            {factor.maximo > 0 ? (
                              <div className="mt-1">
                                <Barra valor={factor.puntos} maximo={factor.maximo} />
                              </div>
                            ) : null}
                            <div className="mt-0.5 text-xs text-tinta-suave">{factor.detalle}</div>
                          </li>
                        ))}
                      </ul>

                      {!ordenActiva ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <form action={asignarProfesional}>
                            <input type="hidden" name="requestId" value={solicitud.id} />
                            <input type="hidden" name="professionalId" value={candidato.professionalId} />
                            <Boton className="!py-1.5 !text-xs">Asignar</Boton>
                          </form>
                          {["CONTACTADO", "RECHAZO", "NO_RESPONDIO"].map((estado) => (
                            <form key={estado} action={actualizarCandidato}>
                              <input type="hidden" name="candidatoId" value={candidato.id} />
                              <input type="hidden" name="estado" value={estado} />
                              <Boton tipo="secundario" className="!py-1.5 !text-xs">
                                {etiqueta(ESTADOS_MATCH, estado)}
                              </Boton>
                            </form>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {descartados.length > 0 ? (
                  <details className="p-4">
                    <summary className="cursor-pointer text-sm text-tinta-suave">
                      {descartados.length} descartados — por qué no califican
                    </summary>
                    <ul className="mt-3 space-y-1.5">
                      {descartados.map((candidato) => (
                        <li key={candidato.id} className="flex justify-between gap-3 text-sm">
                          <span>{candidato.professional.nombre}</span>
                          <span className="text-tinta-suave">{candidato.motivo}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-tinta-suave">
                      Estos descartes son el mapa de qué habilidades faltan en esta zona.
                    </p>
                  </details>
                ) : null}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitulo>Cliente</CardTitulo>
            <div className="space-y-3 p-4 text-sm">
              <div>
                <Link
                  href={`/panel/clientes/${solicitud.clientId}`}
                  className="font-medium text-sello hover:underline"
                >
                  {solicitud.client.nombre}
                </Link>
                <div className="text-tinta-suave">{solicitud.client.celular}</div>
                <div className="text-xs text-tinta-suave">
                  {solicitud.client.codigo} · {solicitud.client.tipo.toLowerCase()}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-regla pt-3">
                <span className="text-tinta-suave">Trust del cliente</span>
                <span className="cifra font-medium">{solicitud.client.trustScore}</span>
              </div>
              <a
                href={whatsapp(
                  solicitud.client.celular,
                  `Hola ${solicitud.client.nombre.split(" ")[0]}, te escribimos por tu solicitud ${solicitud.codigo}.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sello hover:underline"
              >
                Escribir por WhatsApp →
              </a>
            </div>
          </Card>

          {!ordenActiva && solicitud.estado !== "PERDIDA" ? (
            <Card>
              <CardTitulo>Cerrar como perdida</CardTitulo>
              <form action={marcarPerdida} className="space-y-3 p-4">
                <input type="hidden" name="requestId" value={solicitud.id} />
                <select name="motivoPerdida" className={claseInput} required>
                  <option value="">Motivo…</option>
                  <option value="PRECIO">El precio le pareció alto</option>
                  <option value="SIN_OFERTA">No había profesional disponible</option>
                  <option value="TIEMPO">No podíamos en el tiempo que necesitaba</option>
                  <option value="NO_RESPONDE">El cliente no respondió</option>
                  <option value="RESOLVIO_SOLO">Lo resolvió por otro lado</option>
                  <option value="FUERA_COBERTURA">Fuera de zona de cobertura</option>
                  <option value="OTRO">Otro</option>
                </select>
                <Boton tipo="peligro" className="w-full">
                  Marcar perdida
                </Boton>
                <p className="text-xs text-tinta-suave">
                  El motivo es obligatorio: es el único dato que explica por qué el funnel se cae.
                </p>
              </form>
            </Card>
          ) : null}

          {solicitud.estado === "PERDIDA" ? (
            <Aviso tono="alerta">
              Perdida — motivo: {solicitud.motivoPerdida || "sin registrar"}
            </Aviso>
          ) : null}

          <Card>
            <CardTitulo>Notas internas</CardTitulo>
            <form action={guardarNotas} className="space-y-3 p-4">
              <input type="hidden" name="requestId" value={solicitud.id} />
              <textarea
                name="notasInternas"
                rows={4}
                className={claseInput}
                defaultValue={solicitud.notasInternas}
                placeholder="Lo que pasó por WhatsApp y no está en ningún campo."
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
