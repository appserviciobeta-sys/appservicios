"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { registrarEvento } from "@/lib/events";
import { fallar } from "@/lib/errores";
import { guardarEvidencia } from "@/lib/almacenamiento";
import { recalcularTrust } from "@/lib/trust-engine";

function ruta(token: string) {
  return `/t/${token}`;
}

/// El token ES la credencial. Ninguna acción acepta un id de orden: si alguien
/// adivina un id no puede hacer nada, y el enlace se puede revocar solo.
async function ordenPorToken(token: string) {
  const orden = await prisma.serviceOrder.findUnique({
    where: { tokenProfesional: token },
    include: { serviceType: true, request: true, cambiosAlcance: true, evidencias: true },
  });
  if (!orden) fallar("/", "Este enlace no es válido o ya venció.");
  return orden;
}

function coordenadas(formData: FormData) {
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const validas = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
  return validas ? { lat, lng } : null;
}

export async function marcarEnCamino(formData: FormData) {
  const token = String(formData.get("token"));
  const orden = await ordenPorToken(token);

  if (!["ASIGNADA", "CONFIRMADA"].includes(orden.estado)) {
    fallar(ruta(token), "Este servicio ya no está en estado de salida.");
  }

  await prisma.serviceOrder.update({
    where: { id: orden.id },
    data: { estado: "EN_CAMINO", enCaminoAt: new Date() },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "EN_CAMINO",
    actor: "profesional",
  });

  redirect(ruta(token));
}

export async function registrarLlegada(formData: FormData) {
  const token = String(formData.get("token"));
  const orden = await ordenPorToken(token);
  const gps = coordenadas(formData);

  if (orden.estado !== "EN_CAMINO" && orden.estado !== "ASIGNADA" && orden.estado !== "CONFIRMADA") {
    fallar(ruta(token), "Este servicio ya está iniciado.");
  }

  await prisma.serviceOrder.update({
    where: { id: orden.id },
    data: { estado: "EN_SITIO", llegadaAt: new Date() },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "LLEGADA",
    actor: "profesional",
    payload: { gps: gps ?? "sin permiso de ubicación" },
  });

  redirect(ruta(token));
}

/**
 * §17 — el segundo factor de la puerta.
 *
 * El profesional ya mostró la palabra de seguridad; el cliente le dictó el
 * código. Si no coincide, no se inicia y queda el intento registrado: puede ser
 * un error al dictar o alguien que no debería estar ahí.
 */
export async function verificarCodigo(formData: FormData) {
  const token = String(formData.get("token"));
  const codigo = String(formData.get("codigo") ?? "").trim();
  const orden = await ordenPorToken(token);
  const gps = coordenadas(formData);

  if (orden.checkInAt) fallar(ruta(token), "Este servicio ya fue iniciado.");

  if (codigo !== orden.codigoServicio) {
    await registrarEvento({
      entidad: "ServiceOrder",
      entidadId: orden.id,
      tipo: "CHECK_IN_RECHAZADO",
      actor: "profesional",
      payload: { codigoIntentado: codigo, gps },
    });
    fallar(
      ruta(token),
      "El código no coincide. Pídeselo otra vez al cliente y no empieces el trabajo.",
    );
  }

  await prisma.serviceOrder.update({
    where: { id: orden.id },
    data: {
      estado: "EN_EJECUCION",
      checkInAt: new Date(),
      checkInLat: gps?.lat ?? null,
      checkInLng: gps?.lng ?? null,
    },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "CHECK_IN",
    actor: "profesional",
    payload: { verificado: true, gps: gps ?? "sin permiso de ubicación" },
  });

  // Llegó: el recorrido ya no le sirve a nadie y se borra. La constancia de la
  // llegada queda en checkInAt/checkInLat/checkInLng, que es el único dato que
  // hace falta guardar.
  //
  // Ojo con el caso contrario: si NO hay check-in, el rastro se conserva. Es
  // justo la situación en que sirve de prueba — "no llegó" contra "sí fui" —
  // así que desaparece cuando sobra y sobrevive cuando importa.
  await prisma.locationPing.deleteMany({ where: { serviceOrderId: orden.id } });

  redirect(ruta(token));
}

export async function subirEvidencia(formData: FormData) {
  const token = String(formData.get("token"));
  const tipo = String(formData.get("tipo") ?? "ANTES");
  const nota = String(formData.get("nota") ?? "").trim();
  const orden = await ordenPorToken(token);

  const archivo = formData.get("foto");
  let url = "";
  if (archivo instanceof File && archivo.size > 0) {
    const resultado = await guardarEvidencia(archivo, orden.codigo);
    if (resultado.error) fallar(ruta(token), resultado.error);
    url = resultado.ruta ?? "";
  }

  if (!url && !nota) fallar(ruta(token), "Toma una foto o escribe una nota.");

  await prisma.evidence.create({
    data: { serviceOrderId: orden.id, tipo, url, nota, subidoPor: "PROFESIONAL" },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "EVIDENCIA_REGISTRADA",
    actor: "profesional",
    payload: { tipoEvidencia: tipo, conFoto: Boolean(url) },
  });

  redirect(ruta(token));
}

/// §27 — el profesional propone, el cliente decide. Nunca al revés.
export async function pedirCambioAlcance(formData: FormData) {
  const token = String(formData.get("token"));
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const precioAdicional = Number(formData.get("precioAdicional") ?? 0);
  const minutosAdicionales = Number(formData.get("minutosAdicionales") ?? 0);
  const orden = await ordenPorToken(token);

  if (descripcion.length < 10) {
    fallar(ruta(token), "Explica bien qué encontraste: el cliente tiene que entender qué aprueba.");
  }

  const archivo = formData.get("foto");
  let fotoUrl = "";
  if (archivo instanceof File && archivo.size > 0) {
    const resultado = await guardarEvidencia(archivo, orden.codigo);
    if (resultado.error) fallar(ruta(token), resultado.error);
    fotoUrl = resultado.ruta ?? "";
  }

  if (!fotoUrl) {
    fallar(ruta(token), "Toma una foto de lo que encontraste. Sin foto el cliente no puede aprobar.");
  }

  await prisma.scopeChange.create({
    data: {
      serviceOrderId: orden.id,
      descripcion,
      fotoUrl,
      precioAdicional: Number.isFinite(precioAdicional) ? Math.max(0, precioAdicional) : 0,
      minutosAdicionales: Number.isFinite(minutosAdicionales) ? Math.max(0, minutosAdicionales) : 0,
      estado: "SOLICITADO",
    },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "CAMBIO_ALCANCE_SOLICITADO",
    actor: "profesional",
    payload: { precioAdicional, descripcion },
  });

  redirect(ruta(token));
}

export async function terminarTrabajo(formData: FormData) {
  const token = String(formData.get("token"));
  const orden = await ordenPorToken(token);
  const gps = coordenadas(formData);

  if (!orden.checkInAt) fallar(ruta(token), "Todavía no has iniciado este servicio.");
  if (orden.cambiosAlcance.some((c) => c.estado === "SOLICITADO")) {
    fallar(
      ruta(token),
      "Tienes un trabajo adicional esperando respuesta del cliente. Resuélvelo antes de cerrar.",
    );
  }

  // Sin foto del después no hay con qué defenderse en un reclamo. Es protección
  // del profesional tanto como del cliente.
  const hayDespues = orden.evidencias.some((e) => e.tipo === "DESPUES" && e.url);
  if (!hayDespues) {
    fallar(ruta(token), "Sube al menos una foto del trabajo terminado antes de cerrar.");
  }

  await prisma.serviceOrder.update({
    where: { id: orden.id },
    data: {
      estado: "EJECUTADA",
      checkOutAt: new Date(),
      checkOutLat: gps?.lat ?? null,
      checkOutLng: gps?.lng ?? null,
    },
  });

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: orden.id,
    tipo: "CHECK_OUT",
    actor: "profesional",
    payload: { gps: gps ?? "sin permiso de ubicación" },
  });

  if (orden.professionalId) await recalcularTrust(orden.professionalId, "Servicio ejecutado");

  redirect(ruta(token));
}
