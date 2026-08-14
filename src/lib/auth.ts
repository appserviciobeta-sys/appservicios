import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export { hashearClave, verificarClave, generarClave } from "@/lib/claves";

/**
 * Sesión del panel interno.
 *
 * El panel muestra direcciones de casas, cédulas y teléfonos. Sin control de
 * acceso no se puede operar con datos reales, así que esto es requisito legal
 * (Ley 1581 de 2012), no una comodidad.
 *
 * El hasheo de contraseñas vive en claves.ts, que no depende de Next y por eso
 * se puede usar desde un script de consola.
 */

const COOKIE = "sesion_operador";
const DURACION_HORAS = 12;

function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "Falta AUTH_SECRET (mínimo 32 caracteres). Genéralo con: npm run secreto",
    );
  }
  return s;
}

type Carga = { id: string; emitida: number; expira: number };

function firmar(datos: string): string {
  return createHmac("sha256", secreto()).update(datos).digest("base64url");
}

function crearToken(operadorId: string): string {
  const ahora = Date.now();
  const carga: Carga = {
    id: operadorId,
    emitida: ahora,
    expira: ahora + DURACION_HORAS * 3600 * 1000,
  };
  const cuerpo = Buffer.from(JSON.stringify(carga)).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

function leerToken(token: string): Carga | null {
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;

  const esperada = Buffer.from(firmar(cuerpo));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;

  try {
    const carga = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as Carga;
    return carga.expira > Date.now() ? carga : null;
  } catch {
    return null;
  }
}

export async function abrirSesion(operadorId: string) {
  const galletas = await cookies();
  galletas.set(COOKIE, crearToken(operadorId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_HORAS * 3600,
  });
}

export async function cerrarSesion() {
  const galletas = await cookies();
  galletas.delete(COOKIE);
}

export type Operador = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
};

/// Devuelve el operador de la sesión, o null. No redirige.
export async function operadorActual(): Promise<Operador | null> {
  const galletas = await cookies();
  const token = galletas.get(COOKIE)?.value;
  if (!token) return null;

  const carga = leerToken(token);
  if (!carga) return null;

  const operador = await prisma.operator.findUnique({ where: { id: carga.id } });
  if (!operador || !operador.activo) return null;

  // Permite expulsar a alguien sin esperar a que expire su cookie: basta con
  // adelantar sesionesDesde.
  if (operador.sesionesDesde.getTime() > carga.emitida) return null;

  return {
    id: operador.id,
    nombre: operador.nombre,
    email: operador.email,
    rol: operador.rol,
  };
}

/**
 * Exige sesión. Se llama en el layout del panel Y en cada server action.
 *
 * El layout solo protege lo que se ve: un server action se puede invocar
 * directamente por HTTP sin pasar por ninguna página. Por eso cada acción que
 * escribe tiene que verificar por su cuenta.
 */
export async function requerirOperador(): Promise<Operador> {
  const operador = await operadorActual();
  if (!operador) redirect("/entrar");
  return operador;
}

export async function requerirAdmin(): Promise<Operador> {
  const operador = await requerirOperador();
  if (operador.rol !== "ADMIN") {
    redirect("/panel?error=" + encodeURIComponent("Esa acción es solo para administradores."));
  }
  return operador;
}
