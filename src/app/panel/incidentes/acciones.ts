"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requerirOperador } from "@/lib/auth";
import { registrarEvento } from "@/lib/events";
import { fallar } from "@/lib/errores";
import { recalcularTrust, recalcularTrustCliente } from "@/lib/trust-engine";

/// §33: registrar → preservar evidencia → escuchar ambas partes → investigar →
/// decidir. Cerrar un incidente exige escribir qué se decidió, a quién se le
/// atribuye y cuánto costó.
export async function resolverIncidente(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const incidenteId = String(formData.get("incidenteId"));
  const estado = String(formData.get("estado"));
  const resolucion = String(formData.get("resolucion") ?? "").trim();
  const responsable = String(formData.get("responsable") ?? "NINGUNO");
  const costoPlataforma = Number(formData.get("costoPlataforma") ?? 0);

  const cerrado = ["RESUELTO", "CERRADO_SIN_ACCION"].includes(estado);
  if (cerrado && resolucion.length < 10) {
    fallar("/panel/incidentes", "Para cerrar un incidente hay que escribir qué se decidió y por qué.");
  }

  const incidente = await prisma.incident.update({
    where: { id: incidenteId },
    data: {
      estado,
      resolucion,
      responsable,
      costoPlataforma: Number.isFinite(costoPlataforma) ? Math.max(0, costoPlataforma) : 0,
      cerradoAt: cerrado ? new Date() : null,
    },
    include: { serviceOrder: true },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: incidente.serviceOrderId,
    tipo: "INCIDENTE_ACTUALIZADO",
    payload: { codigo: incidente.codigo, estado, responsable, costoPlataforma },
  });

  // El responsable cambia a quién le pega el score: por eso se recalculan ambos.
  if (incidente.serviceOrder.professionalId) {
    await recalcularTrust(
      incidente.serviceOrder.professionalId,
      `Incidente ${incidente.codigo} → ${estado}`,
    );
  }
  await recalcularTrustCliente(incidente.serviceOrder.clientId);

  redirect("/panel/incidentes");
}
