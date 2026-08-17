"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Compartir ubicación mientras se va en camino.
 *
 * Diseñado para que el trabajador entienda el trato sin leer un párrafo legal:
 * un botón para prender, uno para apagar, y en pantalla siempre visible desde
 * cuándo está compartiendo y cuándo se detiene solo.
 *
 * Es opcional de verdad. Si lo deja apagado, el servicio sigue igual: el
 * cliente ve "en camino" sin minutos, que es exactamente lo que ve hoy. Nada
 * en el flujo lo castiga por no prenderlo.
 */

/// El permiso se recuerda por servicio, no globalmente: haber aceptado en un
/// trabajo no es haber aceptado en el siguiente.
const llave = (token: string) => `rastro:${token}`;

type Estado = "APAGADO" | "PIDIENDO" | "ACTIVO" | "NEGADO" | "CERRADO";

export function CompartirUbicacion({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>("APAGADO");
  const [enviados, setEnviados] = useState(0);
  const vigilante = useRef<number | null>(null);

  const detener = useCallback(() => {
    if (vigilante.current != null) {
      navigator.geolocation.clearWatch(vigilante.current);
      vigilante.current = null;
    }
  }, []);

  /// Solo engancha el vigilante del GPS. No toca el estado de React: se llama
  /// desde un efecto, y cambiar estado ahí de forma síncrona dispara renders en
  /// cascada. Las transiciones ocurren en los callbacks, que son asíncronos.
  const vigilar = useCallback(() => {
    if (!navigator.geolocation) return false;

    vigilante.current = navigator.geolocation.watchPosition(
      async (posicion) => {
        setEstado("ACTIVO");
        try {
          const respuesta = await fetch("/api/rastro", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              token,
              lat: posicion.coords.latitude,
              lng: posicion.coords.longitude,
              precisionM: posicion.coords.accuracy,
            }),
          });

          // 409 = el servicio ya no está "en camino" (hizo check-in o se
          // canceló). El servidor cierra la ventana y el celular obedece: así
          // el rastreo no puede quedar prendido por un descuido.
          if (respuesta.status === 409) {
            detener();
            localStorage.removeItem(llave(token));
            setEstado("CERRADO");
            return;
          }

          const datos = await respuesta.json();
          if (datos.guardado) setEnviados((n) => n + 1);
        } catch {
          // Sin datos en el celular no pasa nada: la siguiente lectura reintenta.
          // No se le muestra un error al profesional por un bache de señal.
        }
      },
      (error) => {
        detener();
        // 1 = PERMISSION_DENIED. Los demás son fallas de GPS, no una negativa.
        if (error.code === 1) {
          localStorage.removeItem(llave(token));
          setEstado("NEGADO");
        } else {
          setEstado("APAGADO");
        }
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return true;
  }, [token, detener]);

  // Cada acción del servidor recarga la página. Sin esto, el profesional
  // tendría que volver a prenderlo tras cada toque.
  useEffect(() => {
    if (localStorage.getItem(llave(token)) === "si") vigilar();
    return detener;
  }, [token, vigilar, detener]);

  function prender() {
    if (!navigator.geolocation) return setEstado("NEGADO");
    localStorage.setItem(llave(token), "si");
    // Cambiar estado desde un manejador de evento sí es correcto.
    setEstado("PIDIENDO");
    vigilar();
  }

  function apagar() {
    localStorage.removeItem(llave(token));
    detener();
    setEstado("APAGADO");
  }

  if (estado === "CERRADO") return null;

  if (estado === "NEGADO") {
    return (
      <div className="ficha p-5">
        <div className="rotulo">Ubicación bloqueada</div>
        <p className="mt-2 text-sm leading-relaxed text-tinta-media">
          Tu celular tiene el permiso de ubicación negado para esta página. Puedes seguir el
          trabajo normalmente: el cliente verá que vas en camino, solo que sin los minutos.
        </p>
      </div>
    );
  }

  const activo = estado === "ACTIVO" || estado === "PIDIENDO";

  return (
    <div className={`ficha p-5 ${activo ? "border-l-[3px] border-l-sello" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="rotulo">Avisarle al cliente cuánto falta</div>
        {activo ? (
          <span className="rotulo text-sello">
            {estado === "PIDIENDO" ? "buscando GPS" : "compartiendo"}
          </span>
        ) : null}
      </div>

      {activo ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-tinta-media">
            El cliente está viendo cuánto falta para que llegues. No ve dónde estás, solo la
            distancia y los minutos.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-tinta-suave">
            Se apaga solo cuando inicies el trabajo
            {enviados > 0 ? ` · ${enviados} ${enviados === 1 ? "señal" : "señales"}` : ""}
          </p>
          <button
            type="button"
            onClick={apagar}
            className="enlace mt-4 text-xs text-tinta-media"
          >
            Dejar de compartir
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-tinta-media">
            Si compartes tu ubicación, el cliente ve cuánto falta y deja de llamar para
            preguntar. Solo mientras vas en camino: al iniciar el trabajo se apaga sola.
          </p>
          <button
            type="button"
            onClick={prender}
            className="mt-4 w-full rounded-[var(--radio-sm)] border border-regla-fuerte py-3 text-sm font-medium"
          >
            Compartir mientras voy
          </button>
          <p className="mt-3 text-xs leading-relaxed text-tinta-suave">
            Es opcional. Si no lo prendes, el trabajo sigue igual.
          </p>
        </>
      )}
    </div>
  );
}
