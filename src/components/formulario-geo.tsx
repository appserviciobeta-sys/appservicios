"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Formulario que adjunta la ubicación antes de enviar.
 *
 * Si el profesional niega el permiso o el GPS no responde, el formulario se
 * manda igual: no podemos bloquear un servicio real porque un celular viejo no
 * dio coordenadas. La ausencia queda registrada en la bitácora, que es lo
 * honesto — decir "no hubo GPS" en vez de fingir que sí.
 */
export function FormularioGeo({
  action,
  children,
  className = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const listo = useRef(false);
  const [buscando, setBuscando] = useState(false);

  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    if (listo.current) return; // segunda pasada: ya tiene coordenadas
    evento.preventDefault();

    const form = ref.current;
    if (!form) return;

    const continuar = () => {
      listo.current = true;
      setBuscando(false);
      form.requestSubmit();
    };

    if (!navigator.geolocation) return continuar();

    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const lat = form.elements.namedItem("lat") as HTMLInputElement | null;
        const lng = form.elements.namedItem("lng") as HTMLInputElement | null;
        if (lat) lat.value = String(posicion.coords.latitude);
        if (lng) lng.value = String(posicion.coords.longitude);
        continuar();
      },
      continuar,
      { timeout: 8000, enableHighAccuracy: true },
    );
  }

  return (
    <form ref={ref} action={action} onSubmit={alEnviar} className={className}>
      <input type="hidden" name="lat" defaultValue="" />
      <input type="hidden" name="lng" defaultValue="" />
      {children}
      {buscando ? (
        <p className="rotulo mt-2 text-center">Tomando ubicación…</p>
      ) : null}
    </form>
  );
}
