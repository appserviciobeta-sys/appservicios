import { distanciaMetros } from "@/lib/puerta";

/**
 * Cuánto falta para que llegue.
 *
 * Este archivo no toca la base ni las APIs de Next a propósito: corre igual en
 * el servidor y en el navegador, y se puede probar con datos sueltos.
 *
 * La pregunta que resuelve es una sola, la que hace el cliente cada cinco
 * minutos: "¿ya casi?". Lo que NO resuelve, por decisión y no por límite
 * técnico, es "¿dónde está exactamente?" — ver el comentario de LocationPing.
 */

/// Un GPS de celular en una ciudad con edificios entrega lecturas de ±3 km sin
/// avisar. Tomar una de esas como buena haría saltar el "va a 40 minutos" a
/// "está en la puerta" y de vuelta. Se descartan de entrada.
export const PRECISION_MAX_M = 500;

/// Sin señal fresca no se inventa nada: se dice que no hay señal. Un ETA
/// calculado sobre una posición de hace veinte minutos es peor que no dar ETA,
/// porque el cliente lo cree.
export const FRESCURA_MAX_MS = 6 * 60_000;

/// Velocidad de respaldo cuando todavía no hay dos lecturas para medir la real.
/// 18 km/h es lo que rinde una moto en Cali o Bogotá contando semáforos: ir más
/// optimista genera la promesa que después no se cumple.
export const VELOCIDAD_BASE_KMH = 18;

/// Por debajo de esto el profesional está prácticamente en la puerta y la
/// precisión del GPS ya no alcanza para distinguir. Se deja de contar minutos.
export const RADIO_LLEGADA_M = 150;

export type Ping = { lat: number; lng: number; precisionM?: number | null; createdAt: Date };

export type Llegada =
  | { estado: "SIN_DESTINO" }
  | { estado: "SIN_SENAL"; ultimaSenalMin?: number }
  | { estado: "LLEGANDO"; distanciaM: number; ultimaSenalMin: number }
  | { estado: "EN_CAMINO"; distanciaM: number; minutos: number; ultimaSenalMin: number };

/// La velocidad se saca del recorrido real y no de una constante: alguien en
/// moto por la Autopista y alguien caminando dos cuadras no pueden compartir
/// ETA. Si el tramo medido no sirve (muy corto, muy lento, absurdo de rápido),
/// se cae a la base.
function velocidadKmh(pings: Ping[]): number {
  if (pings.length < 2) return VELOCIDAD_BASE_KMH;

  const [reciente, previo] = pings;
  const metros = distanciaMetros(previo.lat, previo.lng, reciente.lat, reciente.lng);
  const ms = reciente.createdAt.getTime() - previo.createdAt.getTime();
  if (ms <= 0) return VELOCIDAD_BASE_KMH;

  const kmh = (metros / 1000) / (ms / 3_600_000);

  // Menos de 4 km/h es un semáforo o un trancón, no el ritmo del viaje.
  // Más de 80 km/h en ciudad es un salto de GPS, no un carro.
  if (kmh < 4 || kmh > 80) return VELOCIDAD_BASE_KMH;

  // Se promedia con la base para que un tramo suelto de vía libre no prometa
  // una llegada que el resto del trayecto no va a sostener.
  return (kmh + VELOCIDAD_BASE_KMH) / 2;
}

/**
 * `pings` viene del más reciente al más viejo (orderBy createdAt desc), que es
 * como sale de la consulta. `ahora` se pasa como parámetro para poder probar
 * esto sin depender del reloj.
 */
export function calcularLlegada(
  destino: { lat: number | null; lng: number | null },
  pings: Ping[],
  ahora: Date = new Date(),
): Llegada {
  if (destino.lat == null || destino.lng == null) return { estado: "SIN_DESTINO" };

  const utiles = pings.filter(
    (p) => p.precisionM == null || p.precisionM <= PRECISION_MAX_M,
  );
  const ultimo = utiles[0];
  if (!ultimo) return { estado: "SIN_SENAL" };

  const desfaseMs = ahora.getTime() - ultimo.createdAt.getTime();
  const ultimaSenalMin = Math.floor(desfaseMs / 60_000);
  if (desfaseMs > FRESCURA_MAX_MS) return { estado: "SIN_SENAL", ultimaSenalMin };

  const distanciaM = distanciaMetros(ultimo.lat, ultimo.lng, destino.lat, destino.lng);
  if (distanciaM <= RADIO_LLEGADA_M) {
    return { estado: "LLEGANDO", distanciaM, ultimaSenalMin };
  }

  const kmh = velocidadKmh(utiles);
  const minutos = Math.max(1, Math.round((distanciaM / 1000 / kmh) * 60));

  return { estado: "EN_CAMINO", distanciaM, minutos, ultimaSenalMin };
}

/// Redondeo honesto: nadie mide una espera en unidades de un minuto, y decir
/// "faltan 7" cuando el dato no da para tanta precisión quema la confianza la
/// primera vez que no se cumple.
///
/// Se llama distinto de `minutosATexto` de format.ts a propósito: aquel formatea
/// una duración conocida ("1 h 30"), este comunica una estimación con su
/// incertidumbre incluida ("unos 10 minutos"). Confundirlos sería prometer
/// exactitud que el dato no tiene.
export function esperaATexto(minutos: number): string {
  if (minutos <= 2) return "menos de 3 minutos";
  if (minutos <= 5) return "unos 5 minutos";
  if (minutos <= 10) return "unos 10 minutos";
  if (minutos <= 20) return `unos ${Math.round(minutos / 5) * 5} minutos`;
  if (minutos <= 60) return `unos ${Math.round(minutos / 10) * 10} minutos`;
  return "más de una hora";
}

export function distanciaATexto(metros: number): string {
  if (metros < 1000) return `${Math.round(metros / 100) * 100} m`;
  return `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}
