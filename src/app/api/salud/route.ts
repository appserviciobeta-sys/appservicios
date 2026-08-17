import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { operadorActual } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Desarma una URL de conexión sin revelar la contraseña.
 *
 * De la contraseña solo sale su longitud y una huella (los primeros 10 hex de
 * un SHA-256). Dos huellas iguales significan misma contraseña; distintas,
 * distinta. Es lo único que hace falta para saber si la de Vercel coincide con
 * la que sí funciona en local, y no expone nada.
 */
function radiografia(url: string | undefined) {
  if (!url) return { definida: false };
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]*)@([^:/]+):(\d+)\/([^?]+)(\?.*)?$/);
  if (!m) return { definida: true, formato: "no se entiende", largo: url.length };

  const [, usuario, clave, host, puerto, base, parametros] = m;
  return {
    definida: true,
    usuario,
    host,
    puerto,
    base,
    parametros: parametros ?? "(ninguno)",
    claveLargo: clave.length,
    claveHuella: createHash("sha256").update(clave).digest("hex").slice(0, 10),
    // Espacios o saltos de línea pegados al final rompen la autenticación y
    // son invisibles en la caja de texto de Vercel.
    claveConEspacios: clave !== clave.trim(),
    urlConEspacios: url !== url.trim(),
  };
}

/**
 * Diagnóstico del despliegue: GET /api/salud
 *
 * Dice qué variable falta y si la base responde, sin exponer ningún valor.
 * Existe porque un 500 en producción no cuenta nada: Next oculta el detalle
 * del error por seguridad, y uno termina adivinando cuál de seis variables
 * quedó sin poner.
 */
const REQUERIDAS = [
  { nombre: "DATABASE_URL", para: "la app (pooler 6543)" },
  { nombre: "DIRECT_URL", para: "migraciones (pooler 5432)" },
  { nombre: "NEXT_PUBLIC_SUPABASE_URL", para: "cliente de Supabase" },
  { nombre: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", para: "clave pública" },
];

const OPCIONALES = [
  { nombre: "SUPABASE_SERVICE_ROLE_KEY", para: "fotos de evidencia (sin esto van a disco)" },
  { nombre: "NEXT_PUBLIC_URL_BASE", para: "dominio propio (si no, se deduce solo)" },
];

/// El panel exige AUTH_SECRET para firmar la cookie de sesión. Si falta, el
/// login autentica bien y aun así rebota al entrar: un síntoma muy confuso.
function revisarAcceso() {
  const secreto = process.env.AUTH_SECRET;
  return {
    definida: Boolean(secreto),
    largo: secreto?.length ?? 0,
    suficiente: (secreto?.length ?? 0) >= 32,
  };
}

function revisar(lista: { nombre: string; para: string }[]) {
  return lista.map(({ nombre, para }) => {
    const valor = process.env[nombre];
    return {
      variable: nombre,
      definida: Boolean(valor),
      // Nunca el valor: solo lo justo para notar que quedó vacía o con corchetes.
      largo: valor?.length ?? 0,
      sospechosa: valor ? /\[|\]|YOUR-PASSWORD/i.test(valor) : false,
      para,
    };
  });
}

/**
 * ¿Quién está preguntando?
 *
 * Sin sesión este endpoint solo dice si el sistema está sano y qué variable
 * falta: lo justo para levantar el despliegue. El detalle (host de la base,
 * usuario, huellas de contraseña, cuántos administradores hay) queda detrás de
 * la sesión, porque es justamente el mapa que necesitaría alguien para atacar.
 *
 * `operadorActual` revienta si falta AUTH_SECRET, que es precisamente uno de
 * los casos que este endpoint tiene que poder diagnosticar. De ahí el catch.
 */
async function esOperador(): Promise<boolean> {
  try {
    return (await operadorActual()) !== null;
  } catch {
    return false;
  }
}

export async function GET() {
  const obligatorias = revisar(REQUERIDAS);
  const opcionales = revisar(OPCIONALES);
  const faltantes = obligatorias.filter((v) => !v.definida).map((v) => v.variable);
  const autenticado = await esOperador();

  let estado = "no se intentó";
  let detalleBase: Record<string, unknown> = {};

  if (faltantes.length === 0) {
    try {
      const { prisma } = await import("@/lib/db");
      const categorias = await prisma.category.count();
      const servicios = await prisma.serviceType.count();

      // La tabla de operadores puede no existir todavía: se crea a mano desde
      // el editor SQL cuando las credenciales locales no sirven.
      let operadores: unknown;
      try {
        const total = await prisma.operator.count();
        const activos = await prisma.operator.count({ where: { activo: true } });
        const admins = await prisma.operator.count({ where: { rol: "ADMIN", activo: true } });
        operadores = { tabla: "existe", total, activos, admins };
      } catch {
        operadores = { tabla: "NO EXISTE", queHacer: "Corre el bloque CREATE TABLE en Supabase" };
      }

      estado = "conecta";
      detalleBase = { categorias, servicios, operadores };
    } catch (e) {
      estado = "falla";
      // El mensaje de Postgres puede incluir la cadena de conexión.
      detalleBase = { detalle: e instanceof Error ? e.message.slice(0, 300) : String(e) };
    }
  }

  const sano = faltantes.length === 0 && estado === "conecta";

  const publico = {
    sano,
    queHacer: sano
      ? "Todo en orden."
      : faltantes.length > 0
        ? `Faltan variables de entorno: ${faltantes.join(", ")}. Agrégalas en Vercel y redespliega.`
        : "Las variables están, pero la base no responde. Entra al panel y vuelve a consultar para ver el detalle.",
    entorno: process.env.VERCEL_ENV ?? "local",
  };

  if (!autenticado) {
    return NextResponse.json(publico, { status: sano ? 200 : 503 });
  }

  return NextResponse.json(
    {
      ...publico,
      obligatorias,
      opcionales,
      conexion: {
        DATABASE_URL: radiografia(process.env.DATABASE_URL),
        DIRECT_URL: radiografia(process.env.DIRECT_URL),
      },
      acceso: revisarAcceso(),
      baseDatos: { estado, ...detalleBase },
    },
    { status: sano ? 200 : 503 },
  );
}
