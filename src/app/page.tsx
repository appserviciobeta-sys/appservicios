import Link from "next/link";
import { prisma } from "@/lib/db";
import { cop, minutosATexto } from "@/lib/format";
import { SKILLS_HABILITADAS } from "@/lib/constants";
import { IconoCategoria } from "@/components/iconos";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const GARANTIAS = [
  { t: "Precio antes de agendar", d: "El total, no un rango." },
  { t: "Habilidad por habilidad", d: "Verificamos breakers, no “electricista”." },
  { t: "Reemplazo", d: "Si no llega, conseguimos otro." },
  { t: "Sin sobrecostos", d: "Todo adicional lo apruebas tú." },
];

const PASOS = [
  { n: "1", t: "Dinos qué necesitas", d: "Con tus palabras. Nosotros lo clasificamos." },
  { n: "2", t: "Recibe el precio", d: "Total y duración, antes de confirmar." },
  { n: "3", t: "Llega el profesional", d: "Con código de inicio y evidencia del trabajo." },
];

export default async function Landing() {
  const [categorias, vitrina] = await Promise.all([
    prisma.category.findMany({
      where: { activa: true },
      orderBy: { orden: "asc" },
      include: {
        serviceTypes: { where: { activo: true }, orderBy: { precioBase: "asc" } },
      },
    }),
    prisma.professional.findFirst({
      where: { estado: "ACTIVO" },
      orderBy: { trustScore: "desc" },
      include: { skills: { include: { skill: true } } },
    }),
  ]);

  const destacados = categorias
    .flatMap((c) => c.serviceTypes.map((s) => ({ ...s, categoria: c.nombre, slugCat: c.slug })))
    .filter((s) => s.modeloPrecio !== "DIAGNOSTICO")
    .sort((a, b) => a.precioBase - b.precioBase)
    .slice(0, 6);

  const habilidades = (vitrina?.skills ?? []).filter((s) =>
    SKILLS_HABILITADAS.includes(s.estado),
  );

  return (
    <main className="min-h-screen">
      {/* ---- Barra ---- */}
      <header className="sticky top-0 z-20 border-b border-regla bg-papel/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="text-[0.9375rem] font-extrabold tracking-tight">
            Servicios<span className="text-sello">.</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/profesionales/registro"
              className="hidden font-medium text-tinta-media transition-colors hover:text-tinta sm:block"
            >
              Trabaja con nosotros
            </Link>
            <Link
              href="/clientes/registro"
              className="font-semibold text-tinta transition-opacity hover:opacity-70"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5">
        {/* ---- Entrada ---- */}
        <section className="pt-12 pb-8 sm:pt-16">
          <div className="surgir">
            <Badge tono="acento">Bogotá · piloto</Badge>
          </div>

          <h1
            className="surgir titular mt-5 max-w-3xl text-[2.5rem] sm:text-[3.5rem]"
            style={{ "--retraso": "60ms" } as React.CSSProperties}
          >
            ¿Qué necesitas
            <br />
            resolver hoy?
          </h1>

          <p
            className="surgir mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-tinta-media"
            style={{ "--retraso": "120ms" } as React.CSSProperties}
          >
            Te damos el precio antes de agendar y un profesional con habilidades comprobadas una por
            una. Si no llega, te conseguimos otro.
          </p>

          {/* Entrada tipo buscador: el gesto de app de domicilios */}
          <Link
            href="/solicitar"
            className="surgir tocable ficha-alta mt-7 flex items-center gap-3 px-4 py-4"
            style={{ "--retraso": "180ms" } as React.CSSProperties}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-tinta-suave" aria-hidden="true">
              <circle
                cx="11"
                cy="11"
                r="6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="m16 16 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="flex-1 text-[0.9375rem] text-tinta-suave">
              Limpieza, plomería, electricidad…
            </span>
            <span className="hidden rounded-[var(--radio-sm)] bg-tinta px-4 py-2 text-sm font-semibold text-papel sm:block">
              Pedir
            </span>
          </Link>
        </section>

        {/* ---- Categorías ---- */}
        <section
          className="surgir pb-10"
          style={{ "--retraso": "240ms" } as React.CSSProperties}
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {categorias.map((categoria) => (
              <Link
                key={categoria.id}
                href="/solicitar"
                className="tocable ficha flex flex-col items-center gap-2.5 px-2 py-5 text-center"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sello-tenue text-sello">
                  <IconoCategoria slug={categoria.slug} />
                </span>
                <span className="text-[0.8125rem] leading-tight font-semibold">
                  {categoria.nombre}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---- Garantías ---- */}
        <section className="pb-12">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GARANTIAS.map((item, i) => (
              <div
                key={item.t}
                className="surgir ficha p-4"
                style={{ "--retraso": `${300 + i * 50}ms` } as React.CSSProperties}
              >
                <div className="flex items-start gap-2.5">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-sello" aria-hidden="true">
                    <path
                      d="m4.5 12.5 5 5 10-11"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-bold">{item.t}</div>
                    <p className="mt-0.5 text-sm leading-snug text-tinta-media">{item.d}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Servicios con precio ---- */}
        <section className="pb-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="titular text-2xl">Precio conocido</h2>
              <p className="mt-1.5 text-sm text-tinta-media">
                Mano de obra. Lo que ves es lo que se cobra.
              </p>
            </div>
            <Link href="/solicitar" className="enlace shrink-0 text-sm font-semibold text-sello">
              Ver todo
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {destacados.map((servicio) => (
              <Link
                key={servicio.id}
                href="/solicitar"
                className="tocable ficha flex flex-col justify-between gap-4 p-4"
              >
                <div>
                  <div className="rotulo">{servicio.categoria}</div>
                  <div className="mt-1.5 leading-snug font-bold">{servicio.nombre}</div>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="cifra text-xl font-bold">{cop(servicio.precioBase)}</div>
                    <div className="mt-0.5 text-xs text-tinta-suave">
                      {minutosATexto(servicio.duracionMinMin)} aprox.
                    </div>
                  </div>
                  {servicio.garantiaDias > 0 ? (
                    <Badge tono="ok">{servicio.garantiaDias} d garantía</Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ---- Quién entra a tu casa ---- */}
        {vitrina ? (
          <section className="pb-12">
            <div className="ficha-alta overflow-hidden">
              <div className="grid gap-6 p-6 sm:grid-cols-[1fr_1.1fr] sm:items-center sm:p-8">
                <div>
                  <h2 className="titular text-2xl">Sabes quién entra a tu casa</h2>
                  <p className="mt-3 text-sm leading-relaxed text-tinta-media">
                    Antes de abrir, ves la foto, el documento y las habilidades que le comprobamos.
                    Lo que no está verificado también se dice.
                  </p>
                  <Link
                    href="/solicitar"
                    className="mt-5 inline-flex rounded-[var(--radio-sm)] bg-tinta px-5 py-3 text-sm font-semibold text-papel transition-opacity hover:opacity-88"
                  >
                    Pedir un servicio
                  </Link>
                </div>

                <div className="ficha bg-papel p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-tinta text-sm font-bold text-papel">
                      {vitrina.nombre
                        .split(" ")
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join("")}
                    </span>
                    <div>
                      <div className="font-bold">
                        {vitrina.nombre.split(" ")[0]}{" "}
                        {vitrina.nombre.split(" ")[1]?.[0]}.
                      </div>
                      <div className="text-xs text-tinta-suave">
                        {vitrina.aniosExperiencia} años · {vitrina.zonas.split(",")[0]}
                      </div>
                    </div>
                    <span className="ml-auto">
                      <Badge tono="ok">Verificado</Badge>
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2 border-t border-regla pt-4">
                    {habilidades.slice(0, 4).map((registro) => (
                      <li key={registro.id} className="flex items-center gap-2 text-sm">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-sello" aria-hidden="true">
                          <path
                            d="m4.5 12.5 5 5 10-11"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {registro.skill.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* ---- Cómo funciona ---- */}
        <section className="pb-12">
          <h2 className="titular text-2xl">Cómo funciona</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {PASOS.map((paso) => (
              <li key={paso.n} className="ficha p-5">
                <span className="cifra flex h-7 w-7 items-center justify-center rounded-full bg-tinta text-xs font-bold text-papel">
                  {paso.n}
                </span>
                <div className="mt-3 font-bold">{paso.t}</div>
                <p className="mt-1 text-sm leading-relaxed text-tinta-media">{paso.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- Dos puertas ---- */}
        <section className="grid gap-3 pb-14 sm:grid-cols-2">
          <Link href="/clientes/registro" className="tocable ficha p-6">
            <div className="rotulo">Casa o empresa</div>
            <h3 className="mt-2 text-lg font-bold">Crear cuenta de cliente</h3>
            <p className="mt-2 text-sm leading-relaxed text-tinta-media">
              Tu historial, tus direcciones y tus garantías en un solo lugar. Si tienes locales,
              cada sede por aparte.
            </p>
            <span className="enlace mt-4 inline-block text-sm font-semibold text-sello">
              Crear cuenta →
            </span>
          </Link>

          <Link href="/profesionales/registro" className="tocable ficha p-6">
            <div className="rotulo">Electricistas, plomeras, pintores</div>
            <h3 className="mt-2 text-lg font-bold">Trabaja con nosotros</h3>
            <p className="mt-2 text-sm leading-relaxed text-tinta-media">
              Verificamos tus habilidades una por una. La experiencia informal cuenta: lo que
              pedimos es poder comprobarla.
            </p>
            <span className="enlace mt-4 inline-block text-sm font-semibold text-sello">
              Registrarme →
            </span>
          </Link>
        </section>
      </div>

      <footer className="border-t border-regla">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6">
          <span className="text-sm font-bold">
            Servicios<span className="text-sello">.</span>
          </span>
          <p className="max-w-lg text-xs leading-relaxed text-tinta-suave">
            Piloto operado con acompañamiento humano. Los valores son de mano de obra y no incluyen
            materiales salvo que se indique. La garantía varía por servicio.
          </p>
          <Link href="/panel" className="text-xs text-tinta-suave transition-colors hover:text-tinta">
            Panel interno
          </Link>
        </div>
      </footer>
    </main>
  );
}
