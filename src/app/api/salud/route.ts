import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const obligatorias = revisar(REQUERIDAS);
  const opcionales = revisar(OPCIONALES);
  const faltantes = obligatorias.filter((v) => !v.definida).map((v) => v.variable);

  let baseDatos: Record<string, unknown> = { estado: "no se intentó" };

  if (faltantes.length === 0) {
    try {
      const { prisma } = await import("@/lib/db");
      const categorias = await prisma.category.count();
      const servicios = await prisma.serviceType.count();
      baseDatos = { estado: "conecta", categorias, servicios };
    } catch (e) {
      baseDatos = {
        estado: "falla",
        detalle: e instanceof Error ? e.message.slice(0, 300) : String(e),
      };
    }
  } else {
    baseDatos = { estado: "no se intentó", motivo: `faltan variables: ${faltantes.join(", ")}` };
  }

  const sano = faltantes.length === 0 && baseDatos.estado === "conecta";

  return NextResponse.json(
    {
      sano,
      queHacer: sano
        ? "Todo en orden."
        : faltantes.length > 0
          ? `Agrega en Vercel → Settings → Environment Variables: ${faltantes.join(", ")}. Luego Redeploy.`
          : "Las variables están, pero la base no responde. Revisa el detalle de abajo.",
      obligatorias,
      opcionales,
      baseDatos,
      entorno: process.env.VERCEL_ENV ?? "local",
    },
    { status: sano ? 200 : 503 },
  );
}
