import Link from "next/link";
import { redirect } from "next/navigation";
import { operadorActual } from "@/lib/auth";
import { FormularioEntrada } from "./formulario";

export const dynamic = "force-dynamic";

/// Esta página vive fuera del layout protegido del panel: si estuviera dentro,
/// el guardia la mandaría a sí misma en un ciclo infinito.
export default async function EntrarPage() {
  if (await operadorActual()) redirect("/panel");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-[0.9375rem] font-extrabold tracking-tight">
          Operación<span className="text-sello">.</span>
        </Link>

        <h1 className="titular mt-6 text-3xl">Panel interno</h1>
        <p className="mt-2 text-sm leading-relaxed text-tinta-media">
          Aquí se ven direcciones, documentos y teléfonos de personas reales. El acceso queda
          registrado.
        </p>

        <div className="ficha-alta mt-7 p-6">
          <FormularioEntrada />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-tinta-suave">
          ¿Olvidaste tu contraseña? Pídele a un administrador que te la restablezca. No hay
          recuperación por correo todavía.
        </p>
      </div>
    </main>
  );
}
