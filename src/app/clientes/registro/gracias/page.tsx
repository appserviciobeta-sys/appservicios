import Link from "next/link";
import { Badge } from "@/components/ui";

const VENTAJAS = [
  {
    n: "01",
    t: "Historial en un solo lugar",
    d: "Qué se hizo, quién lo hizo, cuánto costó y hasta cuándo va la garantía.",
  },
  {
    n: "02",
    t: "No repetir tus datos",
    d: "Tu dirección y tu zona quedan guardadas para el siguiente servicio.",
  },
  {
    n: "03",
    t: "Reemplazo y soporte",
    d: "Si el profesional no llega, activamos reemplazo sin que tengas que explicar todo otra vez.",
  },
];

export default async function GraciasCliente({
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
          <span className="rotulo">Cuenta creada</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="surgir titular text-[clamp(2.25rem,5.5vw,3.5rem)]">Tu cuenta está lista.</h1>

        {codigo ? (
          <div
            className="surgir ficha relative mt-10 p-7"
            style={{ "--retraso": "120ms" } as React.CSSProperties}
          >
            <div
              className="estampar absolute -top-4 -right-3 bg-superficie text-verificado"
              style={{ "--retraso": "520ms" } as React.CSSProperties}
            >
              <Badge tono="ok" girado>
                Registrado
              </Badge>
            </div>
            <div className="rotulo">Tu código de cliente</div>
            <div className="cifra mt-2 text-4xl">{codigo}</div>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-tinta-media">
              Menciónalo cuando nos escribas y sabemos quién eres de inmediato, sin volver a pedirte
              los datos.
            </p>
          </div>
        ) : null}

        <ol className="mt-16 space-y-8">
          {VENTAJAS.map((item) => (
            <li key={item.n} className="flex gap-5">
              <span className="cifra text-sello">{item.n}</span>
              <div>
                <div className="font-medium">{item.t}</div>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-tinta-media">{item.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-14 flex flex-wrap items-center gap-6">
          <Link
            href="/solicitar"
            className="rounded-[3px] border border-tinta bg-tinta px-6 py-3.5 font-mono text-xs font-medium tracking-[0.1em] text-papel uppercase transition-colors hover:border-sello hover:bg-sello"
          >
            Pedir mi primer servicio
          </Link>
          <Link href="/" className="rotulo enlace hover:text-tinta">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
