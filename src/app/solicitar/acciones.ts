"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registrarEvento } from "@/lib/events";
import { codigoCorto, normalizarCelular } from "@/lib/format";
import { contextoDeFecha, cotizar, type Respuestas } from "@/lib/price-engine";

const Esquema = z.object({
  nombre: z.string().trim().min(3, "Escribe tu nombre completo."),
  celular: z
    .string()
    .trim()
    .transform(normalizarCelular)
    .refine((v) => v.length >= 10, "El celular debe tener al menos 10 dígitos."),
  email: z.string().trim().email("Correo inválido.").or(z.literal("")).default(""),
  direccion: z.string().trim().min(5, "Necesitamos la dirección para poder llegar."),
  zona: z.string().trim().min(2, "Indica el barrio o la zona."),
  servicioSlug: z.string().trim().min(1, "Elige un servicio."),
  urgencia: z.enum(["AHORA", "HOY", "PROGRAMADO", "RECURRENTE"]),
  fechaDeseada: z.string().trim().default(""),
  texto: z.string().trim().default(""),
  respuestas: z.string().default("{}"),
  aceptaDatos: z.string().optional(),
});

export type EstadoSolicitud = { error?: string };

export async function crearSolicitud(
  _previo: EstadoSolicitud,
  formData: FormData,
): Promise<EstadoSolicitud> {
  const parseado = Esquema.safeParse(Object.fromEntries(formData));
  if (!parseado.success) {
    return { error: parseado.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }
  const datos = parseado.data;

  if (!datos.aceptaDatos) {
    return { error: "Necesitamos tu autorización para tratar tus datos." };
  }

  const servicio = await prisma.serviceType.findUnique({
    where: { slug: datos.servicioSlug },
    include: { priceRules: true, category: true },
  });
  if (!servicio || !servicio.activo) {
    return { error: "Ese servicio no está disponible en este momento." };
  }

  if ((datos.urgencia === "PROGRAMADO" || datos.urgencia === "RECURRENTE") && !datos.fechaDeseada) {
    return { error: "Elige la fecha y hora para el servicio." };
  }

  const fechaDeseada = datos.fechaDeseada ? new Date(datos.fechaDeseada) : null;
  if (fechaDeseada && Number.isNaN(fechaDeseada.getTime())) {
    return { error: "La fecha elegida no es válida." };
  }
  if (fechaDeseada && fechaDeseada.getTime() < Date.now() - 60_000) {
    return { error: "La fecha elegida ya pasó." };
  }

  let respuestasCliente: Respuestas = {};
  try {
    respuestasCliente = JSON.parse(datos.respuestas) as Respuestas;
  } catch {
    respuestasCliente = {};
  }

  const respuestas: Respuestas = {
    ...respuestasCliente,
    ...contextoDeFecha(fechaDeseada, datos.urgencia),
  };

  // El precio autoritativo se calcula SIEMPRE en el servidor. Lo que el
  // navegador mostró es una vista previa del mismo motor, no la fuente.
  const cotizacion = cotizar(servicio, respuestas);

  const existente = await prisma.client.findUnique({ where: { celular: datos.celular } });

  if (existente?.estado === "BLOQUEADO") {
    return { error: "No podemos tomar esta solicitud. Escríbenos para revisar tu cuenta." };
  }

  // Si el cliente no tenía cuenta, la solicitud se la crea. El cliente es una
  // entidad propia desde el primer contacto, no un campo de la solicitud.
  const cliente = existente
    ? await prisma.client.update({
        where: { id: existente.id },
        data: {
          nombre: datos.nombre,
          email: datos.email || existente.email,
          zona: datos.zona,
          direccion: datos.direccion,
        },
      })
    : await prisma.client.create({
        data: {
          codigo: codigoCorto("CLI"),
          nombre: datos.nombre,
          celular: datos.celular,
          email: datos.email,
          ciudad: "Bogotá",
          zona: datos.zona,
          direccion: datos.direccion,
          origen: "SOLICITUD",
          aceptaDatos: true,
          aceptaDatosEn: new Date(),
        },
      });

  if (!existente) {
    await registrarEvento({
      entidad: "Client",
      entidadId: cliente.id,
      tipo: "CLIENTE_REGISTRADO",
      actor: "cliente",
      payload: { codigo: cliente.codigo, origen: "SOLICITUD" },
    });
  }

  const codigo = codigoCorto("SOL");
  const solicitud = await prisma.serviceRequest.create({
    data: {
      codigo,
      clientId: cliente.id,
      textoCliente: datos.texto,
      canal: "WEB",
      categoryId: servicio.categoryId,
      serviceTypeId: servicio.id,
      urgencia: datos.urgencia,
      fechaDeseada,
      direccion: datos.direccion,
      zona: datos.zona,
      estado: "COTIZADA",
      riesgo: servicio.riesgo,
      respuestas: JSON.stringify(respuestas),
    },
  });

  await prisma.quote.create({
    data: {
      requestId: solicitud.id,
      serviceTypeId: servicio.id,
      precioTotal: cotizacion.total,
      precioProfesional: cotizacion.pagoProfesional,
      comision: cotizacion.comision,
      duracionEstimadaMin: cotizacion.duracionEstimadaMin,
      estado: "ENVIADA",
      generadoPor: "PRICE_ENGINE",
      lineas: {
        create: cotizacion.lineas.map((linea) => ({
          codigo: linea.codigo,
          etiqueta: linea.etiqueta,
          monto: linea.monto,
          orden: linea.orden,
        })),
      },
    },
  });

  await registrarEvento({
    entidad: "ServiceRequest",
    entidadId: solicitud.id,
    tipo: "SOLICITUD_CREADA",
    actor: "cliente",
    payload: {
      canal: "WEB",
      servicio: servicio.slug,
      urgencia: datos.urgencia,
      total: cotizacion.total,
      requiereDiagnostico: cotizacion.requiereDiagnostico,
      clienteNuevo: !existente,
    },
  });

  redirect(`/solicitar/gracias/${codigo}`);
}
