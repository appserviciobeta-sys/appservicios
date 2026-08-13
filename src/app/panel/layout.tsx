import Link from "next/link";
import type { ReactNode } from "react";

const SECCIONES = [
  { href: "/panel", texto: "Resumen" },
  { href: "/panel/solicitudes", texto: "Solicitudes" },
  { href: "/panel/servicios", texto: "Servicios" },
  { href: "/panel/profesionales", texto: "Profesionales" },
  { href: "/panel/clientes", texto: "Clientes" },
  { href: "/panel/incidentes", texto: "Incidentes" },
  { href: "/panel/catalogo", texto: "Catálogo" },
];

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-regla bg-papel/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/panel" className="text-[0.9375rem] font-extrabold tracking-tight">
            Operación<span className="text-sello">.</span>
          </Link>
          <nav className="scroll-lateral flex gap-x-5 overflow-x-auto text-sm">
            {SECCIONES.map((seccion) => (
              <Link
                key={seccion.href}
                href={seccion.href}
                className="shrink-0 font-medium whitespace-nowrap text-tinta-media transition-colors hover:text-tinta"
              >
                {seccion.texto}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="ml-auto hidden text-sm text-tinta-suave transition-colors hover:text-tinta sm:block"
          >
            Sitio público
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8">{children}</main>
    </div>
  );
}
