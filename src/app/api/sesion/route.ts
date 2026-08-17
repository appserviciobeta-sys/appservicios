import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/sesion — por qué no me deja entrar.
 *
 * "Entro y me saca" puede ser cinco cosas distintas y desde afuera se ven
 * iguales: la cookie no llega, la firma no cuadra porque AUTH_SECRET cambió,
 * el token venció, el operador está inactivo, o `sesionesDesde` quedó por
 * delante de la sesión. Sin poder distinguirlas uno termina cambiando la
 * contraseña una y otra vez sin que ese fuera el problema.
 *
 * No pide autenticación —sería absurdo, es el diagnóstico de por qué no la
 * hay— pero solo describe LA COOKIE DE QUIEN PREGUNTA. No acepta parámetros,
 * no dice qué correos existen y no revela nada de la infraestructura. Lo único
 * que devuelve de la base es el nombre del operador dueño de esa cookie, que es
 * quien la está enviando.
 */

const COOKIE = "sesion_operador";

type Carga = { id: string; emitida: number; expira: number };

export async function GET() {
  const secreto = process.env.AUTH_SECRET;

  const base = {
    authSecret: {
      definida: Boolean(secreto),
      largo: secreto?.length ?? 0,
      suficiente: (secreto?.length ?? 0) >= 32,
      // Un salto de línea pegado al final al copiar y pegar en Vercel rompe la
      // firma y es invisible en la caja de texto.
      conEspacios: secreto ? secreto !== secreto.trim() : false,
    },
  };

  const galletas = await cookies();
  const token = galletas.get(COOKIE)?.value;

  if (!token) {
    return NextResponse.json({
      ...base,
      cookie: "no llegó",
      diagnostico:
        "El navegador no está mandando la cookie de sesión. O nunca entraste, o el login no llegó a crearla.",
    });
  }

  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) {
    return NextResponse.json({ ...base, cookie: "malformada", diagnostico: "La cookie está corrupta. Borra las cookies del sitio y vuelve a entrar." });
  }

  if (!secreto) {
    return NextResponse.json({ ...base, cookie: "presente", diagnostico: "Falta AUTH_SECRET: no se puede validar ninguna sesión." });
  }

  const esperada = Buffer.from(createHmac("sha256", secreto).update(cuerpo).digest("base64url"));
  const recibida = Buffer.from(firma);
  const firmaValida =
    esperada.length === recibida.length && timingSafeEqual(esperada, recibida);

  if (!firmaValida) {
    return NextResponse.json({
      ...base,
      cookie: "presente",
      firmaValida: false,
      diagnostico:
        "La firma no cuadra: esta cookie se emitió con otro AUTH_SECRET. Pasa al rotarlo. Sal y vuelve a entrar.",
    });
  }

  let carga: Carga;
  try {
    carga = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as Carga;
  } catch {
    return NextResponse.json({ ...base, cookie: "presente", firmaValida: true, diagnostico: "El contenido de la cookie no se puede leer." });
  }

  const ahora = Date.now();
  const vencida = carga.expira <= ahora;

  const operador = await prisma.operator.findUnique({
    where: { id: carga.id },
    select: { nombre: true, email: true, activo: true, rol: true, sesionesDesde: true },
  });

  // Esta es la causa que nadie adivina: si `sesionesDesde` quedó por delante
  // del momento en que se emitió la cookie, el sistema la considera revocada.
  // Pasa al volver a correr el INSERT del operador después de haber entrado,
  // porque ese SQL pone `sesionesDesde = now()`.
  const revocada = operador ? operador.sesionesDesde.getTime() > carga.emitida : false;

  const diagnostico = !operador
    ? "La cookie es válida pero ese operador ya no existe en la base."
    : !operador.activo
      ? "La cuenta está desactivada (activo = false)."
      : vencida
        ? "La sesión venció. Vuelve a entrar."
        : revocada
          ? "La sesión fue revocada: sesionesDesde quedó después de la emisión de esta cookie. Vuelve a entrar — si sigue pasando, el INSERT del operador se está corriendo después del login."
          : "Sesión válida. Si aun así no ves el panel, el problema no es la autenticación.";

  return NextResponse.json({
    ...base,
    cookie: "presente",
    firmaValida: true,
    emitida: new Date(carga.emitida).toISOString(),
    expira: new Date(carga.expira).toISOString(),
    vencida,
    operador: operador
      ? {
          nombre: operador.nombre,
          rol: operador.rol,
          activo: operador.activo,
          sesionesDesde: operador.sesionesDesde.toISOString(),
        }
      : null,
    revocada,
    diagnostico,
  });
}
