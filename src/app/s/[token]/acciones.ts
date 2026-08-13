"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { registrarEvento } from "@/lib/events";
import { fallar } from "@/lib/errores";
import { codigoCorto } from "@/lib/format";
import { recalcularTrust, recalcularTrustCliente } from "@/lib/trust-engine";

function ruta(token: string) {
  return `/s/${token}`;
}

async function ordenPorToken(token: string) {
  const orden = await prisma.serviceOrder.findUnique({
    where: { tokenCliente: token },
    include: { serviceType: true, cambiosAlcance: true },
  });
  if (!orden) fallar("/", "Este enlace no es válido o ya venció.");
  return orden;
}

/// §27 — la decisión es del cliente y queda con hora. Aprobar sube el precio
/// del servicio en el acto; rechazar lo deja como estaba.
export async function responderCambio(formData: FormData) {
  const token = String(formData.get("token"));
  const cambioId = String(formData.get("cambioId"));
  const estado = String(formData.get("estado"));
  const orden = await ordenPorToken(token);

  const cambio = orden.cambiosAlcance.find((c) => c.id === cambioId);
  if (!cambio) fallar(ruta(token), "Ese trabajo adicional no existe.");
  if (cambio.estado !== "SOLICITADO") fallar(ruta(token), "Ese trabajo adicional ya fue respondido.");

  await prisma.scopeChange.update({
    where: { id: cambioId },
    data: { estado, resueltoAt: new Date() },
  });

  if (estado === "APROBADO" && cambio.precioAdicional > 0) {
    const porcentaje = orden.serviceType.porcentajeProfesional;
    const pagoAdicional = Math.round((cambio.precioAdicional * porcentaje) / 100);

    await prisma.serviceOrder.update({
      where: { id: orden.id },
      data: {
        precioCliente: orden.precioCliente + cambio.precioAdicional,
        pagoProfesional: orden.pagoProfesional + pagoAdicional,
        comision: orden.comision + (cambio.precioAdicional - pagoAdicional),
      },
    });
  }

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "CAMBIO_ALCANCE_RESUELTO",
    actor: "cliente",
    payload: { estado, precioAdicional: cambio.precioAdicional },
  });

  redirect(ruta(token));
}

/**
 * El cliente cierra el servicio, no el profesional.
 *
 * Si dice que quedó bien, se libera el pago. Si no, se abre un incidente en el
 * acto con la evidencia todavía fresca: es el único momento en que reconstruir
 * lo que pasó todavía es fácil (§33).
 */
export async function confirmarServicio(formData: FormData) {
  const token = String(formData.get("token"));
  const resultado = String(formData.get("resultado"));
  const detalle = String(formData.get("detalle") ?? "").trim();
  const orden = await ordenPorToken(token);

  if (!orden.checkOutAt) fallar(ruta(token), "El profesional todavía no ha cerrado el trabajo.");
  if (orden.confirmadoClienteAt) fallar(ruta(token), "Ya confirmaste este servicio.");

  if (resultado === "RECLAMO" && detalle.length < 10) {
    fallar(ruta(token), "Cuéntanos qué pasó para poder resolverlo.");
  }

  await prisma.serviceOrder.update({
    where: { id: orden.id },
    data: {
      confirmadoClienteAt: new Date(),
      confirmacionCliente: resultado,
      // El pago solo se autoriza si el cliente dio el visto bueno.
      estadoPago: resultado === "OK" ? "AUTORIZADO" : orden.estadoPago,
    },
  });

  if (resultado === "RECLAMO") {
    await prisma.incident.create({
      data: {
        codigo: codigoCorto("INC"),
        serviceOrderId: orden.id,
        reportadoPor: "CLIENTE",
        tipo: "CALIDAD",
        severidad: "MEDIO",
        descripcion: detalle,
        estado: "ABIERTO",
      },
    });
  }

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "CONFIRMACION_CLIENTE",
    actor: "cliente",
    payload: { resultado, detalle },
  });

  if (orden.professionalId) {
    await recalcularTrust(orden.professionalId, `Cliente confirmó: ${resultado}`);
  }

  redirect(ruta(token));
}

export async function calificarDesdeCliente(formData: FormData) {
  const token = String(formData.get("token"));
  const calidad = Number(formData.get("calidad") ?? 0);
  const puntualidad = Number(formData.get("puntualidad") ?? 0);
  const comunicacion = Number(formData.get("comunicacion") ?? 0);
  const comentario = String(formData.get("comentario") ?? "").trim();
  const orden = await ordenPorToken(token);

  await prisma.rating.upsert({
    where: { serviceOrderId_emisor: { serviceOrderId: orden.id, emisor: "CLIENTE" } },
    create: {
      serviceOrderId: orden.id,
      emisor: "CLIENTE",
      calidad: calidad || null,
      puntualidad: puntualidad || null,
      comunicacion: comunicacion || null,
      comentario,
    },
    update: {
      calidad: calidad || null,
      puntualidad: puntualidad || null,
      comunicacion: comunicacion || null,
      comentario,
    },
  });

  if (orden.estado === "EJECUTADA") {
    await prisma.serviceOrder.update({ where: { id: orden.id }, data: { estado: "CALIFICADA" } });
  }

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "CALIFICACION",
    actor: "cliente",
    payload: { calidad, puntualidad, comunicacion },
  });

  if (orden.professionalId) {
    await recalcularTrust(orden.professionalId, "Nueva calificación del cliente");
  }
  await recalcularTrustCliente(orden.clientId);

  redirect(ruta(token));
}

/// §35 — el cliente puede pedir reemplazo sin llamar a nadie.
export async function pedirReemplazo(formData: FormData) {
  const token = String(formData.get("token"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  const orden = await ordenPorToken(token);

  if (orden.checkOutAt) fallar(ruta(token), "Este servicio ya terminó.");

  await prisma.replacement.create({
    data: {
      serviceOrderId: orden.id,
      motivo: motivo || "CLIENTE_PIDIO",
      profesionalSalienteId: orden.professionalId,
      estado: "SOLICITADO",
    },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "REEMPLAZO_PEDIDO_POR_CLIENTE",
    actor: "cliente",
    payload: { motivo },
  });

  redirect(ruta(token));
}
