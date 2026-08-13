import { prisma } from "@/lib/db";
import { Encabezado } from "@/components/encabezado";
import { FormularioRegistro, type CategoriaConSkills } from "./formulario";

export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const categorias = await prisma.category.findMany({
    where: { activa: true },
    orderBy: { orden: "asc" },
    include: { skills: { orderBy: { nombre: "asc" } } },
  });

  const datos: CategoriaConSkills[] = categorias.map((c) => ({
    nombre: c.nombre,
    skills: c.skills.map((s) => ({
      slug: s.slug,
      nombre: s.nombre,
      requiereCertificacion: s.requiereCertificacion,
    })),
  }));

  return (
    <main className="min-h-screen">
      <Encabezado
        rotulo="Registro de profesional"
        titulo="Que tu oficio quede comprobado"
        bajada="Registramos habilidad por habilidad, no oficios genéricos. Un electricista que domina tableros vale distinto a uno que solo cambia tomacorrientes, y queremos poder demostrarlo."
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        <FormularioRegistro categorias={datos} />
      </div>
    </main>
  );
}
