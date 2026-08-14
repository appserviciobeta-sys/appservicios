"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrada } from "./acciones";
import { Aviso, Boton, Campo, claseInput } from "@/components/ui";

export function FormularioEntrada() {
  const [estado, accion, enviando] = useActionState<EstadoEntrada, FormData>(entrar, {});

  return (
    <form action={accion} className="space-y-5">
      <Campo etiqueta="Correo">
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className={claseInput}
        />
      </Campo>

      <Campo etiqueta="Contraseña">
        <input
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          className={claseInput}
        />
      </Campo>

      {estado.error ? <Aviso tono="alerta">{estado.error}</Aviso> : null}

      <Boton className="w-full !py-3.5" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
