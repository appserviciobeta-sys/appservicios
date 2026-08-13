import { prisma } from "@/lib/db";
import { cop, minutosATexto } from "@/lib/format";
import { MODELOS_PRECIO, etiqueta } from "@/lib/constants";
import { Badge, Card, CardTitulo, Tabla, Td, Th } from "@/components/ui";
import { CabeceraPanel } from "@/components/panel";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const categorias = await prisma.category.findMany({
    orderBy: { orden: "asc" },
    include: {
      skills: { orderBy: { nombre: "asc" } },
      serviceTypes: {
        orderBy: { precioBase: "asc" },
        include: { priceRules: { orderBy: { orden: "asc" } }, skills: { include: { skill: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <CabeceraPanel
        titulo="Catálogo"
        bajada="Precios y habilidades del piloto. Son supuestos de trabajo: se reemplazan con lo que muestren los primeros 100 servicios, no con lo que diga el mercado en abstracto."
      />

      {categorias.map((categoria) => (
        <Card key={categoria.id}>
          <CardTitulo
            accion={
              <div className="flex items-center gap-2">
                <Badge>{categoria.grupo}</Badge>
                <Badge
                  tono={
                    categoria.riesgo === "ALTO"
                      ? "alerta"
                      : categoria.riesgo === "MEDIO"
                        ? "aviso"
                        : "neutro"
                  }
                >
                  Riesgo {categoria.riesgo.toLowerCase()}
                </Badge>
              </div>
            }
          >
            {categoria.nombre}
          </CardTitulo>

          <div className="border-b border-regla p-4">
            <div className="rotulo">Habilidades verificables</div>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {categoria.skills.map((skill) => (
                <span key={skill.id} className="text-sm">
                  {skill.nombre}
                  {skill.requiereCertificacion ? (
                    <span className="rotulo ml-1.5 text-aviso">certificación</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <Tabla>
            <thead>
              <tr>
                <Th>Servicio</Th>
                <Th>Modelo</Th>
                <Th>Duración</Th>
                <Th>Garantía</Th>
                <Th>Modificadores</Th>
                <Th right>Base</Th>
              </tr>
            </thead>
            <tbody>
              {categoria.serviceTypes.map((servicio) => (
                <tr key={servicio.id}>
                  <Td>
                    <div className="font-medium">{servicio.nombre}</div>
                    <div className="mt-0.5 text-xs text-tinta-suave">
                      requiere:{" "}
                      {servicio.skills
                        .filter((s) => s.obligatoria)
                        .map((s) => s.skill.nombre)
                        .join(", ") || "—"}
                    </div>
                  </Td>
                  <Td className="text-tinta-media">
                    {etiqueta(MODELOS_PRECIO, servicio.modeloPrecio)}
                  </Td>
                  <Td className="cifra text-xs text-tinta-media">
                    {minutosATexto(servicio.duracionMinMin)}–{minutosATexto(servicio.duracionMaxMin)}
                  </Td>
                  <Td className="text-tinta-media">
                    {servicio.garantiaDias > 0 ? `${servicio.garantiaDias} días` : "—"}
                  </Td>
                  <Td>
                    {servicio.priceRules.length === 0 ? (
                      <span className="text-tinta-suave">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {servicio.priceRules.map((regla) => (
                          <li key={regla.id} className="flex items-baseline gap-2 text-xs">
                            <span className="text-tinta-media">{regla.etiqueta}</span>
                            <span className="min-w-3 flex-1 translate-y-[-3px] border-b border-dotted border-regla" />
                            <span className="cifra">
                              {regla.tipo === "MULTIPLICADOR"
                                ? `+${regla.valor}%`
                                : `+${cop(regla.valor)}`}
                              {regla.tipo === "POR_UNIDAD" ? " c/u" : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Td>
                  <Td right>
                    <div className="cifra text-base">{cop(servicio.precioBase)}</div>
                    <div className="rotulo">{servicio.porcentajeProfesional}% al profesional</div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Card>
      ))}
    </div>
  );
}
