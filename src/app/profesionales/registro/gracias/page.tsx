import Link from "next/link";
import { Badge } from "@/components/ui";

const PASOS = [
  {
    n: "01",
    t: "Verificamos tu identidad",
    d: "Te pediremos cédula y antecedentes por WhatsApp. Sin eso no podemos mandarte a la casa de nadie.",
  },
  {
    n: "02",
    t: "Verificamos tus habilidades",
    d: "Según el oficio: preguntas técnicas, un caso a resolver, fotos de trabajos anteriores o una prueba práctica. Las habilidades de alto riesgo necesitan certificación de una entidad.",
  },
  {
    n: "03",
    t: "Te activamos",
    d: "Empiezas recibiendo trabajos de las habilidades que quedaron verificadas. Las demás siguen en proceso.",
  },
];

export default async function GraciasRegistro({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;

  return (
    <main className="min-h-screen">
      <header className="border-b border-regla-fuerte">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="titular text-lg">
            Servicios <span className="text-sello">verificados</span>
          </Link>
          <span className="rotulo">Registro recibido</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="surgir titular text-[clamp(2.25rem,5.5vw,3.5rem)]">
          Gracias por registrarte.
        </h1>

        {codigo ? (
          <div
            className="surgir ficha relative mt-10 p-7"
            style={{ "--retraso": "120ms" } as React.CSSProperties}
          >
            <div
              className="estampar absolute -top-4 -right-3 bg-superficie text-aviso"
              style={{ "--retraso": "520ms" } as React.CSSProperties}
            >
              <Badge tono="aviso" girado>
                En verificación
              </Badge>
            </div>
            <div className="rotulo">Tu código de profesional</div>
            <div className="cifra mt-2 text-4xl">{codigo}</div>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-tinta-media">
              Guárdalo: te lo pediremos cuando nos escribas.
            </p>
          </div>
        ) : null}

        <ol className="mt-16 space-y-8">
          {PASOS.map((paso) => (
            <li key={paso.n} className="flex gap-5">
              <span className="cifra text-sello">{paso.n}</span>
              <div>
                <div className="font-medium">{paso.t}</div>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-tinta-media">{paso.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-14 border-l-2 border-sello pl-4 text-lg leading-relaxed text-tinta-media">
          Mientras más habilidades verificadas tengas, más trabajos te llegan y mejor pagados. Ese es
          todo el truco.
        </p>

        <Link href="/" className="rotulo enlace mt-12 inline-block text-sello hover:text-tinta">
          ← Volver al inicio
        </Link>
      </div>
    </main>
  );
}
