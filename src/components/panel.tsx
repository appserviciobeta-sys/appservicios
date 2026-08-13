import Link from "next/link";
import type { ReactNode } from "react";

export function CabeceraPanel({
  titulo,
  bajada,
  extra,
}: {
  titulo: string;
  bajada?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="titular text-[1.75rem]">{titulo}</h1>
        {bajada ? <p className="mt-2 max-w-2xl text-sm text-tinta-media">{bajada}</p> : null}
      </div>
      {extra}
    </div>
  );
}

/// Filtros como segmentos. El activo se marca con relleno, no con color: en el
/// panel el acento se reserva para lo que está verificado o pendiente.
export function Filtros({
  base,
  actual,
  opciones,
}: {
  base: string;
  actual: string;
  opciones: { clave: string; texto: string }[];
}) {
  return (
    <div className="scroll-lateral -mx-5 flex gap-2 overflow-x-auto px-5">
      {opciones.map((opcion) => {
        const activo = actual === opcion.clave;
        return (
          <Link
            key={opcion.clave}
            href={`${base}?filtro=${opcion.clave}`}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
              activo
                ? "border-tinta bg-tinta text-papel"
                : "border-regla bg-superficie text-tinta-media hover:border-regla-fuerte"
            }`}
          >
            {opcion.texto}
          </Link>
        );
      })}
    </div>
  );
}

/// Enlace a un expediente. Tabular para que las columnas de códigos no bailen.
export function Folio({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="cifra enlace font-semibold text-sello">
      {children}
    </Link>
  );
}
