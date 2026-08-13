"use client";

import { useActionState, useState } from "react";
import { registrarCliente, type EstadoRegistroCliente } from "./acciones";
import { Aviso, Boton, Campo, Numeral, claseInput } from "@/components/ui";

const TIPOS = [
  { valor: "PERSONA", titulo: "Para mi casa", nota: "Persona natural" },
  { valor: "EMPRESA", titulo: "Para mi empresa", nota: "Uno o varios locales" },
];

export function FormularioCliente() {
  const [estado, accion, enviando] = useActionState<EstadoRegistroCliente, FormData>(
    registrarCliente,
    {},
  );
  const [tipo, setTipo] = useState("PERSONA");
  const esEmpresa = tipo === "EMPRESA";

  return (
    <form action={accion} className="max-w-3xl space-y-10">
      <input type="hidden" name="tipo" value={tipo} />

      <section>
        <Numeral n="01">Para quién es la cuenta</Numeral>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {TIPOS.map((opcion) => (
            <label
              key={opcion.valor}
              className={`cursor-pointer border p-4 transition-all ${
                tipo === opcion.valor
                  ? "border-sello bg-sello-tenue"
                  : "border-regla bg-superficie hover:border-regla-fuerte"
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={tipo === opcion.valor}
                onChange={() => setTipo(opcion.valor)}
              />
              <span className={`block font-medium ${tipo === opcion.valor ? "text-sello" : ""}`}>
                {opcion.titulo}
              </span>
              <span className="mt-0.5 block text-xs text-tinta-suave">{opcion.nota}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <Numeral n="02">Datos de contacto</Numeral>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={esEmpresa ? "Nombre comercial" : "Nombre completo"}>
            <input name="nombre" className={claseInput} required />
          </Campo>
          <Campo etiqueta="Celular" ayuda="Por aquí coordinamos cada servicio.">
            <input name="celular" className={`${claseInput} cifra`} inputMode="tel" required />
          </Campo>
          <Campo etiqueta="Correo (opcional)">
            <input name="email" type="email" className={claseInput} />
          </Campo>
          <Campo etiqueta="Ciudad">
            <input name="ciudad" className={claseInput} defaultValue="Bogotá" required />
          </Campo>
          <Campo etiqueta="Barrio o zona">
            <input name="zona" className={claseInput} placeholder="Chapinero" required />
          </Campo>
          <Campo etiqueta={esEmpresa ? "Dirección de la sede principal" : "Dirección"}>
            <input name="direccion" className={claseInput} placeholder="Calle 63 # 9-40" required />
          </Campo>
        </div>
      </section>

      {esEmpresa ? (
        <section>
          <Numeral n="03">Datos de la empresa</Numeral>
          <p className="mt-3 text-sm text-tinta-suave">
            Con esto podemos facturar, medir tiempos de respuesta por sede y darte un solo punto de
            contacto para todos tus locales.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Razón social">
              <input name="razonSocial" className={claseInput} required={esEmpresa} />
            </Campo>
            <Campo etiqueta="NIT">
              <input name="nit" className={`${claseInput} cifra`} required={esEmpresa} />
            </Campo>
            <Campo etiqueta="Persona de contacto">
              <input name="contactoNombre" className={claseInput} required={esEmpresa} />
            </Campo>
            <Campo etiqueta="Cargo">
              <input name="contactoCargo" className={claseInput} />
            </Campo>
            <Campo etiqueta="¿Cuántas sedes o locales?" ayuda="Después registramos cada una.">
              <input
                name="sedes"
                type="number"
                min={1}
                max={500}
                defaultValue={1}
                className={`${claseInput} cifra`}
              />
            </Campo>
          </div>
        </section>
      ) : (
        <>
          <input type="hidden" name="razonSocial" value="" />
          <input type="hidden" name="nit" value="" />
          <input type="hidden" name="contactoNombre" value="" />
          <input type="hidden" name="contactoCargo" value="" />
          <input type="hidden" name="sedes" value="1" />
        </>
      )}

      <label className="flex cursor-pointer items-start gap-3 border-l-2 border-regla-fuerte pl-4">
        <input type="checkbox" name="aceptaDatos" value="1" className="mt-1" required />
        <span className="text-sm leading-relaxed text-tinta-media">
          Autorizo el tratamiento de mis datos para coordinar servicios, verificar profesionales y
          atender garantías o reclamos.
          <span className="mt-1 block text-xs text-tinta-suave">
            No compartimos tu dirección con nadie que no sea el profesional asignado a tu servicio.
          </span>
        </span>
      </label>

      {estado.error ? <Aviso tono="alerta">{estado.error}</Aviso> : null}

      <div className="flex flex-wrap items-center gap-5">
        <Boton disabled={enviando} className="!py-3">
          {enviando ? "Creando…" : "Crear cuenta"}
        </Boton>
        <p className="text-xs text-tinta-suave">
          Crear la cuenta no cobra nada ni agenda nada todavía.
        </p>
      </div>
    </form>
  );
}
