import { prisma } from "@/lib/db";
import { Encabezado } from "@/components/encabezado";
import { FormularioSolicitud, type ServicioCliente } from "./formulario";

export const dynamic = "force-dynamic";

export default async function SolicitarPage() {
  const servicios = await prisma.serviceType.findMany({
    where: { activo: true },
    orderBy: [{ category: { orden: "asc" } }, { precioBase: "asc" }],
    include: { priceRules: true, category: true },
  });

  // Se envía al navegador solo lo que el motor de precios necesita.
  const paraCliente: ServicioCliente[] = servicios.map((s) => ({
    slug: s.slug,
    nombre: s.nombre,
    descripcion: s.descripcion,
    categoria: s.category.nombre,
    slugCategoria: s.category.slug,
    modeloPrecio: s.modeloPrecio,
    precioBase: s.precioBase,
    duracionMinMin: s.duracionMinMin,
    duracionMaxMin: s.duracionMaxMin,
    porcentajeProfesional: s.porcentajeProfesional,
    garantiaDias: s.garantiaDias,
    priceRules: s.priceRules.map((r) => ({
      codigo: r.codigo,
      etiqueta: r.etiqueta,
      tipo: r.tipo,
      valor: r.valor,
      campo: r.campo,
      valorEsperado: r.valorEsperado,
      umbral: r.umbral,
      minutos: r.minutos,
      orden: r.orden,
    })),
  }));

  return (
    <main className="min-h-screen">
      <Encabezado
        rotulo="Solicitud de servicio"
        titulo="El precio se arma frente a ti"
        bajada="Lo que ves en el recibo es lo que se cobra. Cualquier trabajo adicional que aparezca en sitio se te aprueba antes, con foto y valor."
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        <FormularioSolicitud servicios={paraCliente} />
      </div>
    </main>
  );
}
