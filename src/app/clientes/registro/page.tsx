import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { FormularioCliente } from "./formulario";

export default function RegistroClientePage() {
  return (
    <main className="min-h-screen">
      <Encabezado
        rotulo="Registro de cliente"
        titulo="Tu historial en un solo lugar"
        bajada="Tu cuenta guarda direcciones, servicios anteriores y garantías vigentes. Si eres empresa, además manejas varias sedes con un solo punto de contacto."
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        <FormularioCliente />

        <p className="mt-10 border-t border-regla pt-6 text-sm text-tinta-media">
          ¿Solo quieres pedir un servicio ya?{" "}
          <Link href="/solicitar" className="enlace text-sello">
            Puedes pedirlo sin crear cuenta
          </Link>{" "}
          — la creamos automáticamente con tus datos.
        </p>
      </div>
    </main>
  );
}
