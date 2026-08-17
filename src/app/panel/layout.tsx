import Link from "next/link";
import type { ReactNode } from "react";
import { requerirOperador } from "@/lib/auth";
import { salir } from "@/app/entrar/acciones";

const SECCIONES = [
  { href: "/panel", texto: "Resumen" },
  { href: "/panel/solicitudes", texto: "Solicitudes" },
  { href: "/panel/servicios", texto: "Servicios" },
  { href: "/panel/profesionales", texto: "Profesionales" },
  { href: "/panel/clientes", texto: "Clientes" },
  { href: "/panel/dinero", texto: "Dinero" },
  { href: "/panel/incidentes", texto: "Incidentes" },
  { href: "/panel/catalogo", texto: "Catálogo" },
];

/**
 * Guardia del panel.
 *
 * Cubre todo lo que se ve bajo /panel. No cubre los server actions: esos se
 * pueden invocar por HTTP sin pasar por una página, así que cada acción llama
 * a requerirOperador() por su cuenta.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const operador = await requerirOperador();

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

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-sm text-tinta-suave sm:block">
              {operador.nombre}
              {operador.rol === "ADMIN" ? (
                <span className="ml-1.5 text-xs text-sello">admin</span>
              ) : null}
            </span>
            <form action={salir}>
              <button
                type="submit"
                className="text-sm text-tinta-suave transition-colors hover:text-tinta"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8">{children}</main>
    </div>
  );
}
