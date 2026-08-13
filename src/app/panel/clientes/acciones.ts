"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { registrarEvento } from "@/lib/events";
import { fallar } from "@/lib/errores";
import { normalizarCelular } from "@/lib/format";
import { recalcularTrustCliente } from "@/lib/trust-engine";

function ruta(id: string) {
  return `/panel/clientes/${id}`;
}

export async function cambiarEstadoCliente(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const estado = String(formData.get("estado"));
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (estado === "BLOQUEADO" && motivo.length < 10) {
    // Bloquear a un cliente es una decisión seria: tiene que quedar el porqué.
    fallar(ruta(clientId), "Para bloquear un cliente hay que escribir el motivo.");
  }

  const cliente = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  await prisma.client.update({
    where: { id: clientId },
    data: {
      estado,
      notasInternas: motivo
        ? `${cliente.notasInternas}\n[${new Date().toISOString().slice(0, 10)}] ${estado}: ${motivo}`.trim()
        : cliente.notasInternas,
    },
  });

  await registrarEvento({
    entidad: "Client",
    entidadId: clientId,
    tipo: "ESTADO_CLIENTE",
    payload: { estado, motivo },
  });

  redirect(ruta(clientId));
}

export async function guardarNotasCliente(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const notas = String(formData.get("notasInternas") ?? "");

  await prisma.client.update({ where: { id: clientId }, data: { notasInternas: notas } });
  redirect(ruta(clientId));
}

export async function actualizarCliente(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const zona = String(formData.get("zona") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();

  if (nombre.length < 3) fallar(ruta(clientId), "El nombre no puede quedar vacío.");

  await prisma.client.update({
    where: { id: clientId },
    data: { nombre, email, zona, direccion },
  });

  redirect(ruta(clientId));
}

/// §39–§41: la demanda B2B es por local. Sin sedes registradas no se puede
/// medir SLA ni saber dónde falta cobertura para esa empresa.
export async function agregarSede(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const zona = String(formData.get("zona") ?? "").trim();
  const contacto = String(formData.get("contacto") ?? "").trim();
  const celular = normalizarCelular(String(formData.get("celular") ?? ""));

  if (!nombre || !direccion) {
    fallar(ruta(clientId), "La sede necesita nombre y dirección.");
  }

  const cliente = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (cliente.tipo !== "EMPRESA") {
    fallar(ruta(clientId), "Las sedes solo aplican a clientes empresa.");
  }

  await prisma.clientSite.create({
    data: { clientId, nombre, direccion, zona, ciudad: cliente.ciudad, contacto, celular },
  });

  await registrarEvento({
    entidad: "Client",
    entidadId: clientId,
    tipo: "SEDE_AGREGADA",
    payload: { nombre, zona },
  });

  redirect(ruta(clientId));
}

export async function recalcularReputacionCliente(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  await recalcularTrustCliente(clientId);
  redirect(ruta(clientId));
}
