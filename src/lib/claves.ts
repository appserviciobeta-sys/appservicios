import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/**
 * Hasheo y verificación de contraseñas.
 *
 * Vive aparte de auth.ts a propósito: hashear una contraseña no tiene nada que
 * ver con HTTP ni con cookies, y separarlo permite usarlo desde un script de
 * consola (crear operadores) sin arrastrar las APIs de Next.
 *
 * scrypt viene en Node. Una dependencia menos en la ruta de autenticación es
 * una superficie de ataque menos.
 */

// promisify pierde la sobrecarga con opciones, así que se declara el tipo.
const scryptAsync = promisify(scrypt) as (
  clave: string,
  sal: Buffer,
  largo: number,
  opciones: ScryptOptions,
) => Promise<Buffer>;

// N=16384 tarda ~100 ms: lento para quien intenta adivinar por fuerza bruta,
// despreciable para quien entra una vez al día.
const N = 16384;
const R = 8;
const P = 1;
const LARGO = 64;

export async function hashearClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const derivada = (await scryptAsync(clave.normalize("NFKC"), sal, LARGO, {
    N,
    r: R,
    p: P,
  }));
  return `scrypt$${N}$${R}$${P}$${sal.toString("hex")}$${derivada.toString("hex")}`;
}

export async function verificarClave(clave: string, guardada: string): Promise<boolean> {
  const partes = guardada.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const [, n, r, p, salHex, hashHex] = partes;
  const sal = Buffer.from(salHex, "hex");
  const esperado = Buffer.from(hashHex, "hex");

  const derivada = (await scryptAsync(clave.normalize("NFKC"), sal, esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  }));

  // Comparación de tiempo constante: usar === filtraría cuántos bytes
  // coincidieron, que es suficiente para adivinar el hash byte a byte.
  return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
}

/// Contraseña legible para dictarla por teléfono: sin caracteres que se
/// confundan (l/1/I, O/0).
export function generarClave(largo = 16): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(largo);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}
