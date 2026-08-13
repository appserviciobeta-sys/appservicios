import Link from "next/link";

/// Cabecera de las páginas internas del sitio público. Fija arriba, con el
/// mismo gesto que la portada: en móvil siempre hay una salida a la vista.
export function Encabezado({
  rotulo,
  titulo,
  bajada,
}: {
  rotulo: string;
  titulo: string;
  bajada?: string;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-regla bg-papel/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="text-[0.9375rem] font-extrabold tracking-tight">
            Servicios<span className="text-sello">.</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-tinta-media transition-colors hover:text-tinta"
          >
            Salir
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pt-10 pb-2">
        <div className="surgir rotulo">{rotulo}</div>
        <h1
          className="surgir titular mt-3 text-[2rem] sm:text-[2.75rem]"
          style={{ "--retraso": "60ms" } as React.CSSProperties}
        >
          {titulo}
        </h1>
        {bajada ? (
          <p
            className="surgir mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-tinta-media"
            style={{ "--retraso": "120ms" } as React.CSSProperties}
          >
            {bajada}
          </p>
        ) : null}
      </div>
    </>
  );
}
