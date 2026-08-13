import Link from "next/link";
import { prisma } from "@/lib/db";
import { cop, fechaHora } from "@/lib/format";
import {
  ESTADOS_INCIDENTE,
  ORDENES_COMPLETADAS,
  RESPONSABLES,
  SEVERIDADES,
  TIPOS_INCIDENTE,
  etiqueta,
} from "@/lib/constants";
import {
  Badge,
  Boton,
  Campo,
  Card,
  CardTitulo,
  Mensajes,
  Metrica,
  Vacio,
  claseInput,
  tonoEstado,
} from "@/components/ui";
import { CabeceraPanel, Filtros } from "@/components/panel";
import { resolverIncidente } from "./acciones";

export const dynamic = "force-dynamic";

const ABIERTOS = ["ABIERTO", "EN_INVESTIGACION", "ESCALADO"];

export default async function IncidentesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; error?: string; ok?: string }>;
}) {
  const { filtro = "abiertos", error, ok } = await searchParams;

  const where = filtro === "todos" ? {} : { estado: { in: ABIERTOS } };

  const [incidentes, totales, costoTotal, ordenesCompletadas] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: [{ severidad: "asc" }, { abiertoAt: "desc" }],
      include: {
        serviceOrder: { include: { client: true, professional: true, serviceType: true } },
      },
    }),
    prisma.incident.count(),
    prisma.incident.aggregate({ _sum: { costoPlataforma: true } }),
    prisma.serviceOrder.count({ where: { estado: { in: ORDENES_COMPLETADAS } } }),
  ]);

  const costo = costoTotal._sum.costoPlataforma ?? 0;
  const tasa = ordenesCompletadas === 0 ? 0 : (totales / ordenesCompletadas) * 100;
  const reservaReal = ordenesCompletadas === 0 ? 0 : costo / ordenesCompletadas;

  return (
    <div className="space-y-6">
      <CabeceraPanel
        titulo="Incidentes"
        bajada="El costo real de los incidentes es el que debe alimentar la reserva de garantía, no un porcentaje inventado."
      />

      <Mensajes error={error} ok={ok} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Incidentes totales" valor={String(totales)} />
        <Metrica
          etiqueta="Tasa sobre servicios"
          valor={`${tasa.toFixed(1)}%`}
          nota={`${ordenesCompletadas} servicios completados`}
          tono={tasa > 5 ? "alerta" : undefined}
        />
        <Metrica etiqueta="Costo asumido" valor={cop(costo)} nota="Lo que pagó la plataforma" />
        <Metrica
          etiqueta="Reserva real por servicio"
          valor={cop(Math.round(reservaReal))}
          nota="Reemplaza el supuesto del modelo"
        />
      </div>

      <Filtros
        base="/panel/incidentes"
        actual={filtro}
        opciones={[
          { clave: "abiertos", texto: "Abiertos" },
          { clave: "todos", texto: "Todos" },
        ]}
      />

      <Card>
        <CardTitulo>{incidentes.length} incidentes</CardTitulo>
        {incidentes.length === 0 ? (
          <Vacio>No hay incidentes con este filtro.</Vacio>
        ) : (
          <div className="divide-y divide-regla">
            {incidentes.map((incidente) => (
              <div key={incidente.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="cifra font-medium">{incidente.codigo}</span>
                  <Badge tono={incidente.severidad === "ALTO" ? "alerta" : "aviso"}>
                    {etiqueta(SEVERIDADES, incidente.severidad)}
                  </Badge>
                  <Badge>{etiqueta(TIPOS_INCIDENTE, incidente.tipo)}</Badge>
                  <Badge tono={tonoEstado(incidente.estado)}>
                    {etiqueta(ESTADOS_INCIDENTE, incidente.estado)}
                  </Badge>
                  <span className="text-xs text-tinta-suave">
                    {fechaHora(incidente.abiertoAt)} · reportó{" "}
                    {incidente.reportadoPor.toLowerCase()}
                  </span>
                </div>

                <p className="mt-2.5 max-w-3xl text-sm leading-relaxed">{incidente.descripcion}</p>

                <div className="mt-2 text-xs text-tinta-suave">
                  <Link
                    href={`/panel/servicios/${incidente.serviceOrderId}`}
                    className="cifra enlace text-sello"
                  >
                    {incidente.serviceOrder.codigo}
                  </Link>
                  {" · "}
                  {incidente.serviceOrder.serviceType.nombre}
                  {" · cliente "}
                  {incidente.serviceOrder.client.nombre}
                  {incidente.serviceOrder.professional
                    ? ` · profesional ${incidente.serviceOrder.professional.nombre}`
                    : ""}
                </div>

                {incidente.resolucion ? (
                  <div className="mt-3 border-l-2 border-regla-fuerte bg-papel-hondo p-3 text-sm">
                    <div className="rotulo">
                      Resolución · responsable: {etiqueta(RESPONSABLES, incidente.responsable)}
                    </div>
                    <p className="mt-1">{incidente.resolucion}</p>
                    {incidente.costoPlataforma > 0 ? (
                      <div className="mt-1 text-xs text-tinta-suave">
                        Costo asumido:{" "}
                        <span className="cifra">{cop(incidente.costoPlataforma)}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {ABIERTOS.includes(incidente.estado) ? (
                  <form action={resolverIncidente} className="mt-4 grid gap-3 sm:grid-cols-4">
                    <input type="hidden" name="incidenteId" value={incidente.id} />
                    <Campo etiqueta="Estado">
                      <select name="estado" className={claseInput} defaultValue={incidente.estado}>
                        {Object.entries(ESTADOS_INCIDENTE).map(([valor, texto]) => (
                          <option key={valor} value={valor}>
                            {texto}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo etiqueta="Responsable">
                      <select
                        name="responsable"
                        className={claseInput}
                        defaultValue={incidente.responsable}
                      >
                        {Object.entries(RESPONSABLES).map(([valor, texto]) => (
                          <option key={valor} value={valor}>
                            {texto}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo etiqueta="Qué se decidió">
                      <input
                        name="resolucion"
                        className={claseInput}
                        defaultValue={incidente.resolucion}
                      />
                    </Campo>
                    <Campo etiqueta="Costo plataforma">
                      <input
                        name="costoPlataforma"
                        type="number"
                        min={0}
                        className={`${claseInput} cifra`}
                        defaultValue={incidente.costoPlataforma}
                      />
                    </Campo>
                    <div className="sm:col-span-4">
                      <Boton tipo="secundario">Guardar</Boton>
                    </div>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
