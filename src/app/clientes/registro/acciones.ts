"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registrarEvento } from "@/lib/events";
import { codigoCorto, normalizarCelular } from "@/lib/format";

const Esquema = z.object({
  tipo: z.enum(["PERSONA", "EMPRESA"]),
  nombre: z.string().trim().min(3, "Escribe el nombre completo."),
  celular: z
    .string()
    .trim()
    .transform(normalizarCelular)
    .refine((v) => v.length >= 10, "El celular debe tener al menos 10 dígitos."),
  email: z.string().trim().email("Correo inválido.").or(z.literal("")).default(""),
  ciudad: z.string().trim().min(2, "Indica la ciudad."),
  zona: z.string().trim().min(2, "Indica el barrio o la zona."),
  direccion: z.string().trim().min(5, "Necesitamos la dirección para poder llegar."),
  razonSocial: z.string().trim().default(""),
  nit: z.string().trim().default(""),
  contactoNombre: z.string().trim().default(""),
  contactoCargo: z.string().trim().default(""),
  sedes: z.coerce.number().int().min(1).max(500).default(1),
  aceptaDatos: z.string().optional(),
});

export type EstadoRegistroCliente = { error?: string };

export async function registrarCliente(
  _previo: EstadoRegistroCliente,
  formData: FormData,
): Promise<EstadoRegistroCliente> {
  const parseado = Esquema.safeParse(Object.fromEntries(formData));
  if (!parseado.success) {
    return { error: parseado.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }
  const datos = parseado.data;

  if (!datos.aceptaDatos) {
    return { error: "Necesitamos tu autorización para tratar tus datos." };
  }

  if (datos.tipo === "EMPRESA") {
    if (!datos.razonSocial) return { error: "Escribe la razón social de la empresa." };
    if (!datos.nit) return { error: "Escribe el NIT de la empresa." };
    if (!datos.contactoNombre) return { error: "Indica quién es la persona de contacto." };
  }

  const existente = await prisma.client.findUnique({ where: { celular: datos.celular } });
  if (existente) {
    // El cliente ya existía porque pidió un servicio antes: se completa su
    // cuenta en vez de rechazarlo con un "ya está registrado".
    const actualizado = await prisma.client.update({
      where: { id: existente.id },
      data: {
        tipo: datos.tipo,
        nombre: datos.nombre,
        email: datos.email || existente.email,
        ciudad: datos.ciudad,
        zona: datos.zona,
        direccion: datos.direccion,
        razonSocial: datos.razonSocial,
        nit: datos.nit,
        contactoNombre: datos.contactoNombre,
        contactoCargo: datos.contactoCargo,
        sedes: datos.sedes,
        aceptaDatos: true,
        aceptaDatosEn: existente.aceptaDatosEn ?? new Date(),
      },
    });

    await registrarEvento({
      entidad: "Client",
      entidadId: actualizado.id,
      tipo: "CUENTA_COMPLETADA",
      actor: "cliente",
      payload: { tipo: datos.tipo },
    });

    redirect(`/clientes/registro/gracias?codigo=${actualizado.codigo}`);
  }

  const codigo = codigoCorto("CLI");
  const cliente = await prisma.client.create({
    data: {
      codigo,
      tipo: datos.tipo,
      nombre: datos.nombre,
      celular: datos.celular,
      email: datos.email,
      ciudad: datos.ciudad,
      zona: datos.zona,
      direccion: datos.direccion,
      razonSocial: datos.razonSocial,
      nit: datos.nit,
      contactoNombre: datos.contactoNombre,
      contactoCargo: datos.contactoCargo,
      sedes: datos.sedes,
      estado: "ACTIVO",
      origen: "WEB_REGISTRO",
      aceptaDatos: true,
      aceptaDatosEn: new Date(),
    },
  });

  // La sede principal se crea sola: sin sedes no hay demanda B2B por local (§39).
  if (datos.tipo === "EMPRESA") {
    await prisma.clientSite.create({
      data: {
        clientId: cliente.id,
        nombre: "Sede principal",
        direccion: datos.direccion,
        zona: datos.zona,
        ciudad: datos.ciudad,
        contacto: datos.contactoNombre,
        celular: datos.celular,
      },
    });
  }

  await registrarEvento({
    entidad: "Client",
    entidadId: cliente.id,
    tipo: "CLIENTE_REGISTRADO",
    actor: "cliente",
    payload: { codigo, tipo: datos.tipo, ciudad: datos.ciudad, sedes: datos.sedes },
  });

  redirect(`/clientes/registro/gracias?codigo=${codigo}`);
}
