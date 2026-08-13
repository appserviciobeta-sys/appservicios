import { prisma } from "@/lib/db";
import { ESTADOS_PROFESIONAL, NIVELES, SKILLS_HABILITADAS, etiqueta } from "@/lib/constants";
import { Badge, Card, CardTitulo, Tabla, Td, Th, Vacio, tonoEstado } from "@/components/ui";
import { CabeceraPanel, Filtros, Folio } from "@/components/panel";

export const dynamic = "force-dynamic";

const FILTROS = [
  { clave: "todos", texto: "Todos" },
  { clave: "ACTIVO", texto: "Activos" },
  { clave: "EN_VERIFICACION", texto: "En verificación" },
  { clave: "BORRADOR", texto: "Borrador" },
  { clave: "SUSPENDIDO", texto: "Suspendidos" },
];

export default async function ProfesionalesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro = "todos" } = await searchParams;

  const profesionales = await prisma.professional.findMany({
    where: filtro === "todos" ? {} : { estado: filtro },
    orderBy: [{ estado: "asc" }, { trustScore: "desc" }],
    include: { skills: true, documentos: true },
  });

  // Cobertura por zona: sin densidad no se puede prometer reemplazo (§35).
  const porZona = new Map<string, number>();
  for (const pro of profesionales) {
    if (pro.estado !== "ACTIVO") continue;
    for (const zona of pro.zonas.split(",").map((z) => z.trim()).filter(Boolean)) {
      porZona.set(zona, (porZona.get(zona) ?? 0) + 1);
    }
  }
  const zonas = [...porZona.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <CabeceraPanel
        titulo="Profesionales"
        bajada="El Trust Score se calcula, nunca se escribe a mano. Entra al perfil para ver de dónde sale."
      />

      <Filtros base="/panel/profesionales" actual={filtro} opciones={FILTROS} />

      {zonas.length > 0 ? (
        <Card>
          <CardTitulo>Cobertura por zona · profesionales activos</CardTitulo>
          <div className="flex flex-wrap gap-x-8 gap-y-3 p-4">
            {zonas.map(([zona, cantidad]) => (
              <div key={zona} className="flex items-baseline gap-2">
                <span className="text-sm">{zona}</span>
                <span
                  className={`cifra text-lg ${cantidad < 3 ? "text-aviso" : "text-verificado"}`}
                >
                  {cantidad}
                </span>
              </div>
            ))}
          </div>
          <p className="border-t border-regla px-4 py-3 text-xs text-tinta-media">
            Con menos de 3 activos en una zona, la promesa de reemplazo no es sostenible ahí.
          </p>
        </Card>
      ) : null}

      <Card>
        <CardTitulo>{profesionales.length} profesionales</CardTitulo>
        {profesionales.length === 0 ? (
          <Vacio>No hay profesionales con este filtro.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Zonas</Th>
                <Th right>Habilidades</Th>
                <Th>Documentos</Th>
                <Th>Nivel</Th>
                <Th right>Trust</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {profesionales.map((pro) => {
                const verificadas = pro.skills.filter((s) =>
                  SKILLS_HABILITADAS.includes(s.estado),
                ).length;
                const docsPendientes = pro.documentos.filter((d) =>
                  ["PENDIENTE", "EN_REVISION"].includes(d.estado),
                ).length;
                return (
                  <tr key={pro.id} className="transition-colors hover:bg-papel-hondo">
                    <Td>
                      <Folio href={`/panel/profesionales/${pro.id}`}>{pro.nombre}</Folio>
                      <div className="cifra mt-0.5 text-xs text-tinta-suave">{pro.celular}</div>
                    </Td>
                    <Td className="text-tinta-media">{pro.zonas || "—"}</Td>
                    <Td right>
                      <span className="cifra">
                        {verificadas}
                        <span className="text-tinta-suave">/{pro.skills.length}</span>
                      </span>
                      <div className="rotulo">verificadas</div>
                    </Td>
                    <Td>
                      {docsPendientes > 0 ? (
                        <Badge tono="aviso">{docsPendientes} por revisar</Badge>
                      ) : (
                        <span className="rotulo">al día</span>
                      )}
                    </Td>
                    <Td>{etiqueta(NIVELES, pro.nivel)}</Td>
                    <Td right className="cifra text-base">
                      {pro.trustScore}
                    </Td>
                    <Td>
                      <Badge tono={tonoEstado(pro.estado)}>
                        {etiqueta(ESTADOS_PROFESIONAL, pro.estado)}
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
