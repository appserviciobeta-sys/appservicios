import { randomBytes } from "node:crypto";

/**
 * El momento de la puerta (§17).
 *
 * Aquí vive todo lo que hace verificable el instante en que un desconocido
 * entra a la casa de alguien. La regla es simple y va en dos sentidos:
 *
 *   1. El PROFESIONAL dice la palabra de seguridad → el CLIENTE confirma que
 *      coincide con la que ve en su pantalla. Recién ahí abre.
 *   2. El CLIENTE dicta el código → el PROFESIONAL lo digita → check-in.
 *
 * Si solo existiera el paso 2 (que es lo que pide el documento), el cliente
 * no tendría forma de saber si quien tocó es quien mandamos.
 */

/// Enlaces sin contraseña: el piloto no puede exigirle a un plomero que instale
/// una app y cree una cuenta. El token va por WhatsApp y es largo por eso mismo.
export function generarToken(): string {
  return randomBytes(18).toString("base64url");
}

/// Palabras fáciles de decir en voz alta en la puerta de una casa, con ruido y
/// afán. Sin tildes ni letras que se confundan al dictarlas.
const PALABRAS = [
  "MANGO", "ROBLE", "CANELA", "PUERTO", "ARENA", "CEDRO", "LIMON", "BRISA",
  "MONTE", "TRIGO", "CORAL", "NIEBLA", "PLATA", "SIERRA", "PALMA", "RUMBO",
  "TAMBOR", "CAFE", "PUENTE", "SELVA", "MARFIL", "CUMBRE", "AZUL", "VERDE",
];

export function generarPalabraSeguridad(): string {
  const a = PALABRAS[Math.floor(Math.random() * PALABRAS.length)];
  let b = PALABRAS[Math.floor(Math.random() * PALABRAS.length)];
  while (b === a) b = PALABRAS[Math.floor(Math.random() * PALABRAS.length)];
  return `${a} ${b}`;
}

/// Documento parcial para que el cliente contraste con la cédula física sin que
/// el número completo circule por WhatsApp.
export function documentoParcial(documento: string): string {
  const limpio = documento.replace(/\D/g, "");
  if (limpio.length <= 4) return limpio;
  return `••••${limpio.slice(-4)}`;
}

/// Distancia en metros entre dos coordenadas. Sirve para saber si el check-in
/// se hizo realmente en la dirección del servicio y no a veinte cuadras.
export function distanciaMetros(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
