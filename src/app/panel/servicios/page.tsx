import { prisma } from "@/lib/db";
import { cop, fechaHora } from "@/lib/format";
import { ESTADOS_ORDEN, ESTADOS_PAGO, ORDENES_ACTIVAS, etiqueta } from "@/lib/constants";
import { Badge, Card, CardTitulo, Tabla, Td, Th, Vacio, tonoEstado } from "@/components/ui";
import { CabeceraPanel, Filtros, Folio } from "@/components/panel";

export const dynamic = "force-dynamic";

const FILTROS = [
  { clave: "activos", texto: "Activos" },
  { clave: "todos", texto: "Todos" },
  { clave: "EJECUTADA", texto: "Ejecutados" },
  { clave: "CALIFICADA", texto: "Calificados" },
  { clave: "CERRADA", texto: "Cerrados" },
];

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro = "activos" } = await searchParams;

  const where =
    filtro === "todos"
      ? {}
      : filtro === "activos"
        ? { estado: { in: ORDENES_ACTIVAS } }
        : { estado: filtro };

  const ordenes = await prisma.serviceOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      client: true,
      professional: true,
      serviceType: true,
      cambiosAlcance: { where: { estado: "SOLICITADO" } },
    },
  });

  return (
    <div className="space-y-6">
      <CabeceraPanel
        titulo="Servicios"
        bajada="Cada servicio tiene código de inicio, evidencia y cierre. Si algo se ejecutó sin registro, no pasó."
      />

      <Filtros base="/panel/servicios" actual={filtro} opciones={FILTROS} />

      <Card>
        <CardTitulo>{ordenes.length} servicios</CardTitulo>
        {ordenes.length === 0 ? (
          <Vacio>No hay servicios con este filtro.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Cliente</Th>
                <Th>Profesional</Th>
                <Th>Servicio</Th>
                <Th>Programado</Th>
                <Th>Estado</Th>
                <Th>Pago</Th>
                <Th right>Valor</Th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((orden) => (
                <tr key={orden.id} className="transition-colors hover:bg-papel-hondo">
                  <Td>
                    <Folio href={`/panel/servicios/${orden.id}`}>{orden.codigo}</Folio>
                    {orden.cambiosAlcance.length > 0 ? (
                      <div className="mt-1">
                        <Badge tono="aviso">cambio pendiente</Badge>
                      </div>
                    ) : null}
                  </Td>
                  <Td>{orden.client.nombre}</Td>
                  <Td>{orden.professional?.nombre ?? "Sin asignar"}</Td>
                  <Td>{orden.serviceType.nombre}</Td>
                  <Td className="text-tinta-media">
                    {orden.programadoPara ? fechaHora(orden.programadoPara) : "—"}
                  </Td>
                  <Td>
                    <Badge tono={tonoEstado(orden.estado)}>
                      {etiqueta(ESTADOS_ORDEN, orden.estado)}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tono={tonoEstado(orden.estadoPago)}>
                      {etiqueta(ESTADOS_PAGO, orden.estadoPago)}
                    </Badge>
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
    </div>
  );
}
