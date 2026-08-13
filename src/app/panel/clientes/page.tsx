import { prisma } from "@/lib/db";
import { cop, haceCuanto } from "@/lib/format";
import {
  ESTADOS_CLIENTE,
  ORDENES_COMPLETADAS,
  ORIGENES_CLIENTE,
  TIPOS_CLIENTE,
  etiqueta,
} from "@/lib/constants";
import { Badge, Card, CardTitulo, Metrica, Tabla, Td, Th, Vacio, tonoEstado } from "@/components/ui";
import { CabeceraPanel, Filtros, Folio } from "@/components/panel";

export const dynamic = "force-dynamic";

const FILTROS = [
  { clave: "todos", texto: "Todos" },
  { clave: "PERSONA", texto: "Personas" },
  { clave: "EMPRESA", texto: "Empresas" },
];

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro = "todos" } = await searchParams;

  const clientes = await prisma.client.findMany({
    where: filtro === "todos" ? {} : { tipo: filtro },
    orderBy: { createdAt: "desc" },
    include: {
      requests: true,
      ordenes: { select: { estado: true, precioCliente: true } },
      sedesB2B: true,
    },
  });

  const totalPersonas = clientes.filter((c) => c.tipo === "PERSONA").length;
  const totalEmpresas = clientes.filter((c) => c.tipo === "EMPRESA").length;

  // Recurrencia: la métrica que decide si el negocio existe (§62).
  const conMasDeUno = clientes.filter(
    (c) => c.ordenes.filter((o) => ORDENES_COMPLETADAS.includes(o.estado)).length > 1,
  ).length;
  const conAlMenosUno = clientes.filter(
    (c) => c.ordenes.filter((o) => ORDENES_COMPLETADAS.includes(o.estado)).length > 0,
  ).length;
  const recurrencia = conAlMenosUno === 0 ? 0 : (conMasDeUno / conAlMenosUno) * 100;

  return (
    <div className="space-y-6">
      <CabeceraPanel
        titulo="Clientes"
        bajada="El cliente también tiene reputación. La confianza va en los dos sentidos: quien cancela siempre o no paga, también cuesta plata."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Clientes" valor={String(clientes.length)} />
        <Metrica etiqueta="Personas" valor={String(totalPersonas)} />
        <Metrica etiqueta="Empresas" valor={String(totalEmpresas)} />
        <Metrica
          etiqueta="Recurrencia"
          valor={`${recurrencia.toFixed(0)}%`}
          nota={`${conMasDeUno} de ${conAlMenosUno} repiten`}
          tono={conAlMenosUno > 0 && recurrencia < 30 ? "aviso" : undefined}
        />
      </div>

      <Filtros base="/panel/clientes" actual={filtro} opciones={FILTROS} />

      <Card>
        <CardTitulo>{clientes.length} clientes</CardTitulo>
        {clientes.length === 0 ? (
          <Vacio>Todavía no hay clientes registrados.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Tipo</Th>
                <Th>Zona</Th>
                <Th>Origen</Th>
                <Th right>Solic.</Th>
                <Th right>Servicios</Th>
                <Th right>Facturado</Th>
                <Th right>Trust</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => {
                const completadas = cliente.ordenes.filter((o) =>
                  ORDENES_COMPLETADAS.includes(o.estado),
                );
                const facturado = completadas.reduce((acc, o) => acc + o.precioCliente, 0);
                return (
                  <tr key={cliente.id} className="transition-colors hover:bg-papel-hondo">
                    <Td>
                      <Folio href={`/panel/clientes/${cliente.id}`}>{cliente.nombre}</Folio>
                      <div className="mt-0.5 text-xs text-tinta-suave">
                        <span className="cifra">{cliente.celular}</span> ·{" "}
                        {haceCuanto(cliente.createdAt)}
                      </div>
                    </Td>
                    <Td>
                      <Badge tono={cliente.tipo === "EMPRESA" ? "acento" : "neutro"}>
                        {etiqueta(TIPOS_CLIENTE, cliente.tipo)}
                      </Badge>
                      {cliente.sedesB2B.length > 0 ? (
                        <div className="rotulo mt-1">{cliente.sedesB2B.length} sedes</div>
                      ) : null}
                    </Td>
                    <Td className="text-tinta-media">{cliente.zona || "—"}</Td>
                    <Td className="rotulo">{etiqueta(ORIGENES_CLIENTE, cliente.origen)}</Td>
                    <Td right className="cifra">
                      {cliente.requests.length}
                    </Td>
                    <Td right className="cifra">
                      {completadas.length}
                    </Td>
                    <Td right className="cifra">
                      {cop(facturado)}
                    </Td>
                    <Td right className="cifra text-base">
                      {cliente.trustScore}
                    </Td>
                    <Td>
                      <Badge tono={tonoEstado(cliente.estado)}>
                        {etiqueta(ESTADOS_CLIENTE, cliente.estado)}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}
      </Card>
    </div>
  );
}
