"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedir la página cada tantos segundos.
 *
 * El cliente está esperando a alguien en la puerta de su casa: obligarlo a
 * deslizar para recargar mientras mira el reloj es el peor momento posible para
 * pedirle un gesto.
 *
 * Se recarga desde el servidor (router.refresh) en vez de abrir un canal en
 * vivo: para un dato que cambia cada minuto, una petición cada treinta segundos
 * cuesta menos que sostener una conexión abierta, y no se cae cuando el celular
 * cambia de wifi a datos, que es justo lo que pasa cuando alguien está en la
 * ventana esperando.
 */
export function RefrescoVivo({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();

  useEffect(() => {
    // Con la pestaña en segundo plano no se refresca: no tiene sentido gastar
    // datos del celular actualizando algo que nadie está mirando.
    const tic = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);

    // Al volver a la pantalla, actualizar de una: es exactamente cuando el dato
    // viejo se nota.
    const alVolver = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      clearInterval(tic);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [router, segundos]);

  return null;
}
