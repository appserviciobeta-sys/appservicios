"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requerirOperador } from "@/lib/auth";
import { registrarEvento } from "@/lib/events";
import { fallar } from "@/lib/errores";
import { codigoCorto, codigoServicio } from "@/lib/format";
import { generarPalabraSeguridad, generarToken } from "@/lib/puerta";
import { calcularCandidatos } from "@/lib/match-engine";

function ruta(id: string) {
  return `/panel/solicitudes/${id}`;
}

export async function buscarCandidatos(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const requestId = String(formData.get("requestId"));

  const solicitud = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (!solicitud.serviceTypeId) {
    fallar(ruta(requestId), "Clasifica la solicitud en un tipo de servicio antes de buscar match.");
  }

  const candidatos = await calcularCandidatos(requestId);

  await registrarEvento({
    entidad: "ServiceRequest",
    entidadId: requestId,
    tipo: "MATCH_CALCULADO",
    payload: {
      evaluados: candidatos.length,
      elegibles: candidatos.filter((c) => !c.descartado).length,
      mejorScore: candidatos.find((c) => !c.descartado)?.score ?? null,
    },
  });

  redirect(ruta(requestId));
}

export async function asignarProfesional(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const requestId = String(formData.get("requestId"));
  const professionalId = String(formData.get("professionalId"));

  const solicitud = await prisma.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      serviceType: true,
      quotes: { orderBy: { createdAt: "desc" }, take: 1 },
      ordenes: true,
    },
  });

  if (!solicitud.serviceTypeId || !solicitud.serviceType) {
    fallar(ruta(requestId), "La solicitud no tiene tipo de servicio asignado.");
  }
  if (solicitud.ordenes.some((o) => !o.estado.startsWith("CANCELADA"))) {
    fallar(ruta(requestId), "Esta solicitud ya tiene un servicio activo.");
  }

  const cotizacion = solicitud.quotes[0];
  const garantiaDias = solicitud.serviceType.garantiaDias;

  const orden = await prisma.serviceOrder.create({
    data: {
      codigo: codigoCorto("SRV"),
      requestId: solicitud.id,
      quoteId: cotizacion?.id,
      clientId: solicitud.clientId,
      professionalId,
      serviceTypeId: solicitud.serviceTypeId,
      estado: "ASIGNADA",
      // §17: los dos secretos de la puerta. El profesional dice la palabra,
      // el cliente contesta con el código. En ese orden.
      codigoServicio: codigoServicio(),
      palabraSeguridad: generarPalabraSeguridad(),
      tokenProfesional: generarToken(),
      tokenCliente: generarToken(),
      programadoPara: solicitud.fechaDeseada,
      precioCliente: cotizacion?.precioTotal ?? 0,
      pagoProfesional: cotizacion?.precioProfesional ?? 0,
      comision: cotizacion?.comision ?? 0,
      garantiaHasta:
        garantiaDias > 0 ? new Date(Date.now() + garantiaDias * 24 * 3600 * 1000) : null,
    },
  });

  await prisma.serviceRequest.update({ where: { id: requestId }, data: { estado: "ASIGNADA" } });
  await prisma.matchCandidate.updateMany({
    where: { requestId, professionalId },
    data: { estado: "ACEPTO" },
  });
  if (cotizacion) {
    await prisma.quote.update({ where: { id: cotizacion.id }, data: { estado: "ACEPTADA" } });
  }

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "SERVICIO_ASIGNADO",
    payload: { requestId, professionalId, precio: orden.precioCliente },
  });

  redirect(`/panel/servicios/${orden.id}`);
}

export async function actualizarCandidato(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const candidatoId = String(formData.get("candidatoId"));
  const estado = String(formData.get("estado"));
  const motivo = String(formData.get("motivo") ?? "");

  const candidato = await prisma.matchCandidate.update({
    where: { id: candidatoId },
    data: { estado, motivo },
  });

  await registrarEvento({
    entidad: "ServiceRequest",
    entidadId: candidato.requestId,
    tipo: "CANDIDATO_ACTUALIZADO",
    payload: { professionalId: candidato.professionalId, estado, motivo },
  });

  redirect(ruta(candidato.requestId));
}

export async function marcarPerdida(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const requestId = String(formData.get("requestId"));
  const motivo = String(formData.get("motivoPerdida") ?? "").trim();

  if (!motivo) {
    fallar(ruta(requestId), "Elige el motivo de pérdida: sin eso no se puede arreglar el funnel.");
  }

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { estado: "PERDIDA", motivoPerdida: motivo },
  });

  await registrarEvento({
    entidad: "ServiceRequest",
    entidadId: requestId,
    tipo: "SOLICITUD_PERDIDA",
    payload: { motivo },
  });

  redirect(ruta(requestId));
}

export async function guardarNotas(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const requestId = String(formData.get("requestId"));
  const notas = String(formData.get("notasInternas") ?? "");

  await prisma.serviceRequest.update({ where: { id: requestId }, data: { notasInternas: notas } });
  redirect(ruta(requestId));
}
