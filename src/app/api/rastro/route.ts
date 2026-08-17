import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PRECISION_MAX_M } from "@/lib/rastro";

export const dynamic = "force-dynamic";

/**
 * POST /api/rastro — el celular del profesional deja su posición mientras va
 * en camino.
 *
 * La autorización es el token del enlace, el mismo que ya abre la pantalla del
 * trabajo: no hay cuentas ni contraseñas para el profesional a propósito
 * (§ enlaces sin contraseña). Quien no tiene el token no puede escribir aquí.
 *
 * La ventana es lo que protege al trabajador: fuera del estado EN_CAMINO esto
 * responde 409 y no guarda nada. No existe forma de activar el rastreo por
 * fuera del trayecto, ni siquiera desde el panel.
 */
const Esquema = z.object({
  token: z.string().min(10),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  precisionM: z.number().nonnegative().optional(),
});

/// El navegador manda posición cada vez que el GPS se mueve un poco, que puede
/// ser varias veces por segundo. Una fila por cada una llenaría la tabla sin
/// agregar información: a pie son centímetros entre lectura y lectura.
const INTERVALO_MIN_MS = 20_000;

export async function POST(peticion: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const parseado = Esquema.safeParse(cuerpo);
  if (!parseado.success) {
    return NextResponse.json({ error: "datos inválidos" }, { status: 400 });
  }

  const { token, lat, lng, precisionM } = parseado.data;

  const orden = await prisma.serviceOrder.findUnique({
    where: { tokenProfesional: token },
    select: { id: true, estado: true },
  });

  // Mismo mensaje para token inexistente y para token de otro servicio: no hay
  // por qué ayudar a distinguir cuáles existen.
  if (!orden) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

  if (orden.estado !== "EN_CAMINO") {
    return NextResponse.json(
      { error: "fuera de la ventana de trayecto", rastreando: false },
      { status: 409 },
    );
  }

  if (precisionM != null && precisionM > PRECISION_MAX_M) {
    // Se acepta la petición pero no se guarda basura: si el GPS todavía está
    // amarrando satélites, la app no tiene por qué reintentar ni mostrar error.
    return NextResponse.json({ rastreando: true, guardado: false });
  }

  const ultimo = await prisma.locationPing.findFirst({
    where: { serviceOrderId: orden.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (ultimo && Date.now() - ultimo.createdAt.getTime() < INTERVALO_MIN_MS) {
    return NextResponse.json({ rastreando: true, guardado: false });
  }

  await prisma.locationPing.create({
    data: { serviceOrderId: orden.id, lat, lng, precisionM },
  });

  return NextResponse.json({ rastreando: true, guardado: true });
}
