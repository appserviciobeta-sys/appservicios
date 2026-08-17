"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requerirOperador } from "@/lib/auth";
import { registrarEvento } from "@/lib/events";
import { fallar } from "@/lib/errores";
import { codigoCorto } from "@/lib/format";
import { generarPalabraSeguridad, generarToken } from "@/lib/puerta";
import { recalcularTrust, recalcularTrustCliente } from "@/lib/trust-engine";
import { calcularCandidatos } from "@/lib/match-engine";

function ruta(id: string) {
  return `/panel/servicios/${id}`;
}

/// Servicios creados antes de que existieran los enlaces de la puerta, o a los
/// que hay que rotarles el secreto porque se filtró.
export async function generarEnlacesPuerta(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));

  await prisma.serviceOrder.update({
    where: { id: ordenId },
    data: {
      tokenProfesional: generarToken(),
      tokenCliente: generarToken(),
      palabraSeguridad: generarPalabraSeguridad(),
    },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "ENLACES_PUERTA_GENERADOS",
  });

  redirect(ruta(ordenId));
}

/// §17: sin código de servicio no se inicia. Este control es la diferencia
/// entre "un desconocido entró a la casa" y "el profesional asignado llegó".
export async function registrarCheckIn(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));
  const codigo = String(formData.get("codigo") ?? "").trim();

  const orden = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: ordenId } });

  if (orden.checkInAt) {
    fallar(ruta(ordenId), "Este servicio ya tiene check-in registrado.");
  }
  if (codigo !== orden.codigoServicio) {
    // Se deja rastro del intento fallido: un código equivocado puede ser un
    // error de dictado o alguien que no es quien dice ser.
    await registrarEvento({
      entidad: "ServiceOrder",
      entidadId: ordenId,
      tipo: "CHECK_IN_RECHAZADO",
      payload: { codigoIntentado: codigo },
    });
    fallar(
      ruta(ordenId),
      "El código no coincide con el que recibió el cliente. No iniciar el trabajo.",
    );
  }

  await prisma.serviceOrder.update({
    where: { id: ordenId },
    data: { estado: "EN_EJECUCION", checkInAt: new Date() },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "CHECK_IN",
    payload: { verificado: true },
  });

  redirect(ruta(ordenId));
}

export async function registrarCheckOut(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));

  const orden = await prisma.serviceOrder.findUniqueOrThrow({
    where: { id: ordenId },
    include: { cambiosAlcance: true },
  });

  if (!orden.checkInAt) {
    fallar(ruta(ordenId), "No se puede cerrar un servicio que nunca inició.");
  }
  if (orden.cambiosAlcance.some((c) => c.estado === "SOLICITADO")) {
    fallar(ruta(ordenId), "Hay cambios de alcance sin resolver. Resuélvelos antes de cerrar.");
  }

  await prisma.serviceOrder.update({
    where: { id: ordenId },
    data: { estado: "EJECUTADA", checkOutAt: new Date() },
  });

  await registrarEvento({ entidad: "ServiceOrder", entidadId: ordenId, tipo: "CHECK_OUT" });

  if (orden.professionalId) await recalcularTrust(orden.professionalId, "Servicio ejecutado");
  await recalcularTrustCliente(orden.clientId);

  redirect(ruta(ordenId));
}

export async function cambiarEstadoOrden(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));
  const estado = String(formData.get("estado"));

  const orden = await prisma.serviceOrder.update({ where: { id: ordenId }, data: { estado } });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "ESTADO_SERVICIO",
    payload: { estado },
  });

  if (orden.professionalId) await recalcularTrust(orden.professionalId, `Servicio → ${estado}`);
  await recalcularTrustCliente(orden.clientId);

  redirect(ruta(ordenId));
}

// `cambiarEstadoPago` se eliminó a propósito. El estado de pago ya no se
// escribe: lo deriva `estadoPagoDerivado` de los cobros y giros registrados.
// Dejar la acción viva permitiría marcar "COBRADO" por HTTP sin que hubiera
// entrado un peso, que es justamente lo que se quiso cerrar.

/// §27: el sobrecosto no aprobado no existe. Se describe, se fotografía, se
/// cotiza y el cliente decide antes de que se ejecute.
export async function crearCambioAlcance(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const precioAdicional = Number(formData.get("precioAdicional") ?? 0);
  const minutosAdicionales = Number(formData.get("minutosAdicionales") ?? 0);
  const fotoUrl = String(formData.get("fotoUrl") ?? "").trim();

  if (descripcion.length < 10) {
    fallar(ruta(ordenId), "Describe el trabajo adicional: el cliente tiene que entender qué aprueba.");
  }

  await prisma.scopeChange.create({
    data: {
      serviceOrderId: ordenId,
      descripcion,
      precioAdicional: Number.isFinite(precioAdicional) ? Math.max(0, precioAdicional) : 0,
      minutosAdicionales: Number.isFinite(minutosAdicionales) ? Math.max(0, minutosAdicionales) : 0,
      fotoUrl,
      estado: "SOLICITADO",
    },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "CAMBIO_ALCANCE_SOLICITADO",
    payload: { precioAdicional, descripcion },
  });

  redirect(ruta(ordenId));
}

export async function resolverCambioAlcance(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const cambioId = String(formData.get("cambioId"));
  const estado = String(formData.get("estado"));

  const cambio = await prisma.scopeChange.update({
    where: { id: cambioId },
    data: { estado, resueltoAt: new Date() },
    include: { serviceOrder: { include: { serviceType: true } } },
  });

  if (estado === "APROBADO" && cambio.precioAdicional > 0) {
    const orden = cambio.serviceOrder;
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
    entidadId: cambio.serviceOrderId,
    tipo: "CAMBIO_ALCANCE_RESUELTO",
    actor: "cliente",
    payload: { estado, precioAdicional: cambio.precioAdicional },
  });

  redirect(ruta(cambio.serviceOrderId));
}

export async function agregarMaterial(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const cantidad = Number(formData.get("cantidad") ?? 1);
  const precioUnitario = Number(formData.get("precioUnitario") ?? 0);
  const proveedor = String(formData.get("proveedor") ?? "").trim();

  if (!descripcion) fallar(ruta(ordenId), "Describe el material.");

  await prisma.materialItem.create({
    data: {
      serviceOrderId: ordenId,
      descripcion,
      cantidad: Number.isFinite(cantidad) ? cantidad : 1,
      precioUnitario: Number.isFinite(precioUnitario) ? Math.max(0, precioUnitario) : 0,
      proveedor,
    },
  });

  const materiales = await prisma.materialItem.findMany({ where: { serviceOrderId: ordenId } });
  const costo = materiales.reduce((acc, m) => acc + m.precioUnitario * m.cantidad, 0);

  await prisma.serviceOrder.update({
    where: { id: ordenId },
    data: { costoMateriales: Math.round(costo) },
  });

  redirect(ruta(ordenId));
}

export async function agregarEvidencia(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));
  const tipo = String(formData.get("tipo"));
  const nota = String(formData.get("nota") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  if (!nota && !url) fallar(ruta(ordenId), "La evidencia necesita al menos una nota o un enlace.");

  await prisma.evidence.create({ data: { serviceOrderId: ordenId, tipo, nota, url } });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "EVIDENCIA_REGISTRADA",
    payload: { tipoEvidencia: tipo },
  });

  redirect(ruta(ordenId));
}

export async function calificar(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));
  const emisor = String(formData.get("emisor"));
  const calidad = Number(formData.get("calidad") ?? 0);
  const puntualidad = Number(formData.get("puntualidad") ?? 0);
  const comunicacion = Number(formData.get("comunicacion") ?? 0);
  const comentario = String(formData.get("comentario") ?? "").trim();

  const orden = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: ordenId } });

  await prisma.rating.upsert({
    where: { serviceOrderId_emisor: { serviceOrderId: ordenId, emisor } },
    create: {
      serviceOrderId: ordenId,
      emisor,
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
    await prisma.serviceOrder.update({ where: { id: ordenId }, data: { estado: "CALIFICADA" } });
  }

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "CALIFICACION",
    actor: emisor.toLowerCase(),
    payload: { calidad, puntualidad, comunicacion },
  });

  if (orden.professionalId && emisor === "CLIENTE") {
    await recalcularTrust(orden.professionalId, "Nueva calificación del cliente");
  }
  // El profesional también califica al cliente (§32).
  if (emisor === "PROFESIONAL") await recalcularTrustCliente(orden.clientId);

  redirect(ruta(ordenId));
}

export async function abrirIncidente(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));
  const tipo = String(formData.get("tipo"));
  const severidad = String(formData.get("severidad"));
  const reportadoPor = String(formData.get("reportadoPor"));
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  if (descripcion.length < 10) {
    fallar(ruta(ordenId), "Describe el incidente con detalle: después no se puede reconstruir.");
  }

  const orden = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: ordenId } });

  await prisma.incident.create({
    data: {
      codigo: codigoCorto("INC"),
      serviceOrderId: ordenId,
      tipo,
      severidad,
      reportadoPor,
      descripcion,
      estado: "ABIERTO",
    },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "INCIDENTE_ABIERTO",
    payload: { tipo, severidad, reportadoPor },
  });

  if (orden.professionalId) await recalcularTrust(orden.professionalId, `Incidente ${severidad}`);

  redirect(ruta(ordenId));
}

/// §35 Reemplazo. Se mide el tiempo real que toma conseguir sustituto: es la
/// métrica que dice si la promesa se puede sostener en esa zona.
export async function solicitarReemplazo(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  await requerirOperador();

  const ordenId = String(formData.get("ordenId"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!motivo) fallar(ruta(ordenId), "Indica por qué se activa el reemplazo.");

  const orden = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: ordenId } });

  await prisma.replacement.create({
    data: {
      serviceOrderId: ordenId,
      motivo,
      profesionalSalienteId: orden.professionalId,
      estado: "SOLICITADO",
    },
  });

  // Si el cliente pidió el cambio, la cancelación no es culpa del profesional.
  const nuevoEstado = motivo === "CLIENTE_PIDIO" ? "CANCELADA_CLIENTE" : "CANCELADA_PROFESIONAL";

  await prisma.serviceOrder.update({ where: { id: ordenId }, data: { estado: nuevoEstado } });
  await prisma.serviceRequest.update({
    where: { id: orden.requestId },
    data: { estado: "ACEPTADA" },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "REEMPLAZO_SOLICITADO",
    payload: { motivo, profesionalSaliente: orden.professionalId },
  });

  if (orden.professionalId) {
    await recalcularTrust(orden.professionalId, `Reemplazo: ${motivo}`);
  }
  await recalcularTrustCliente(orden.clientId);

  // Se recalcula el match para que el operador tenga sustitutos de inmediato.
  await calcularCandidatos(orden.requestId);

  redirect(ruta(ordenId));
  redirect(`/panel/solicitudes/${orden.requestId}`);
}
