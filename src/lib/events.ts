import { prisma } from "@/lib/db";

/// Bitácora append-only (§53). El piloto se opera por WhatsApp, pero cada
/// decisión queda registrada: sin esto, los primeros 1.000 servicios se
/// pierden como activo de datos.
export async function registrarEvento(params: {
  entidad: string;
  entidadId: string;
  tipo: string;
  actor?: string;
  payload?: Record<string, unknown>;
}) {
  await prisma.eventLog.create({
    data: {
      entidad: params.entidad,
      entidadId: params.entidadId,
      tipo: params.tipo,
      actor: params.actor ?? "operador",
      payload: JSON.stringify(params.payload ?? {}),
    },
  });
}

export async function eventosDe(entidad: string, entidadId: string) {
  return prisma.eventLog.findMany({
    where: { entidad, entidadId },
    orderBy: { createdAt: "desc" },
  });
}
