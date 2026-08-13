import { prisma } from "@/lib/db";
import { cop, fechaHora, haceCuanto } from "@/lib/format";
import { ESTADOS_SOLICITUD, URGENCIAS, etiqueta } from "@/lib/constants";
import { Badge, Card, CardTitulo, Tabla, Td, Th, Vacio, tonoEstado } from "@/components/ui";
import { CabeceraPanel, Filtros, Folio } from "@/components/panel";

export const dynamic = "force-dynamic";

const FILTROS = [
  { clave: "abiertas", texto: "Abiertas" },
  { clave: "todas", texto: "Todas" },
  { clave: "NUEVA", texto: "Nuevas" },
  { clave: "COTIZADA", texto: "Cotizadas" },
  { clave: "ASIGNADA", texto: "Asignadas" },
  { clave: "PERDIDA", texto: "Perdidas" },
];

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro = "abiertas" } = await searchParams;

  const where =
    filtro === "todas"
      ? {}
      : filtro === "abiertas"
        ? { estado: { in: ["NUEVA", "CLASIFICADA", "COTIZADA", "ACEPTADA"] } }
        : { estado: filtro };

  const solicitudes = await prisma.serviceRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      client: true,
      serviceType: true,
      quotes: { orderBy: { createdAt: "desc" }, take: 1 },
      candidatos: { where: { estado: { not: "DESCARTADO" } } },
    },
  });

  return (
    <div className="space-y-6">
      <CabeceraPanel
        titulo="Solicitudes"
        bajada="Toda solicitud se cierra: se asigna o se marca perdida con motivo. Nunca se deja morir en silencio."
      />

      <Filtros base="/panel/solicitudes" actual={filtro} opciones={FILTROS} />

      <Card>
        <CardTitulo>{solicitudes.length} solicitudes</CardTitulo>
        {solicitudes.length === 0 ? (
          <Vacio>No hay solicitudes con este filtro.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Cliente</Th>
                <Th>Servicio</Th>
                <Th>Cuándo</Th>
                <Th>Zona</Th>
                <Th right>Cand.</Th>
                <Th>Estado</Th>
                <Th right>Valor</Th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((solicitud) => (
                <tr key={solicitud.id} className="transition-colors hover:bg-papel-hondo">
                  <Td>
                    <Folio href={`/panel/solicitudes/${solicitud.id}`}>{solicitud.codigo}</Folio>
                    <div className="mt-0.5 text-xs text-tinta-suave">
                      {haceCuanto(solicitud.createdAt)}
                    </div>
                  </Td>
                  <Td>
                    <div>{solicitud.client.nombre}</div>
                    <div className="cifra text-xs text-tinta-suave">{solicitud.client.celular}</div>
                  </Td>
                  <Td>{solicitud.serviceType?.nombre ?? "Sin clasificar"}</Td>
                  <Td>
                    <div>{etiqueta(URGENCIAS, solicitud.urgencia)}</div>
                    {solicitud.fechaDeseada ? (
                      <div className="text-xs text-tinta-suave">
                        {fechaHora(solicitud.fechaDeseada)}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="text-tinta-media">{solicitud.zona || "—"}</Td>
                  <Td right className="cifra">
                    {solicitud.candidatos.length || "—"}
                  </Td>
                  <Td>
                    <Badge tono={tonoEstado(solicitud.estado)}>
                      {etiqueta(ESTADOS_SOLICITUD, solicitud.estado)}
                    </Badge>
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
    </div>
  );
}
