"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registrarEvento } from "@/lib/events";
import { codigoCorto, normalizarCelular } from "@/lib/format";
import { MOTIVO_DOCUMENTO } from "@/lib/constants";
import { recalcularTrust } from "@/lib/trust-engine";

const Esquema = z.object({
  nombre: z.string().trim().min(3, "Escribe tu nombre completo."),
  documento: z.string().trim().min(5, "Escribe tu número de documento."),
  celular: z
    .string()
    .trim()
    .transform(normalizarCelular)
    .refine((v) => v.length >= 10, "El celular debe tener al menos 10 dígitos."),
  email: z.string().trim().email("Correo inválido.").or(z.literal("")).default(""),
  ciudad: z.string().trim().min(2, "Indica tu ciudad."),
  zonas: z.string().trim().min(2, "Indica al menos una zona donde trabajas."),
  aniosExperiencia: z.coerce.number().int().min(0).max(60),
  experiencia: z.string().trim().default(""),
  aceptaDatos: z.string().optional(),
});

export type EstadoRegistro = { error?: string };

/// Documentos que se piden a TODO profesional. Cada uno con su motivo (§48):
/// si no reduce un riesgo concreto, no se pide.
const DOCUMENTOS_BASE = ["CEDULA", "ANTECEDENTES"];

export async function registrarProfesional(
  _previo: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  const parseado = Esquema.safeParse(Object.fromEntries(formData));
  if (!parseado.success) {
    return { error: parseado.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }
  const datos = parseado.data;

  if (!datos.aceptaDatos) {
    return { error: "Necesitamos tu autorización para verificar tus datos y antecedentes." };
  }

  const slugsSkills = formData.getAll("skills").map(String).filter(Boolean);
  if (slugsSkills.length === 0) {
    return { error: "Selecciona al menos una habilidad que sepas hacer." };
  }

  const existente = await prisma.professional.findUnique({ where: { documento: datos.documento } });
  if (existente) {
    return {
      error: "Ya existe un registro con ese documento. Escríbenos si necesitas actualizarlo.",
    };
  }

  const skills = await prisma.skill.findMany({ where: { slug: { in: slugsSkills } } });
  if (skills.length === 0) {
    return { error: "Las habilidades seleccionadas no son válidas." };
  }

  const codigo = codigoCorto("PRO");
  const profesional = await prisma.professional.create({
    data: {
      codigo,
      nombre: datos.nombre,
      documento: datos.documento,
      celular: datos.celular,
      email: datos.email,
      ciudad: datos.ciudad,
      zonas: datos.zonas,
      aniosExperiencia: datos.aniosExperiencia,
      experienciaTexto: datos.experiencia,
      // Nadie entra directo a ACTIVO: primero verificación (§16).
      estado: "EN_VERIFICACION",
      aceptaDatos: true,
      aceptaDatosEn: new Date(),
      skills: {
        // Declarada ≠ verificada. El matching solo usa las verificadas.
        create: skills.map((skill) => ({ skillId: skill.id, estado: "DECLARADA" })),
      },
      documentos: {
        create: DOCUMENTOS_BASE.map((tipo) => ({
          tipo,
          motivoRiesgo: MOTIVO_DOCUMENTO[tipo] ?? "Reducción de riesgo",
          estado: "PENDIENTE",
        })),
      },
    },
  });

  await registrarEvento({
    entidad: "Professional",
    entidadId: profesional.id,
    tipo: "PROFESIONAL_REGISTRADO",
    actor: "profesional",
    payload: { codigo, skills: slugsSkills, ciudad: datos.ciudad },
  });

  await recalcularTrust(profesional.id, "Registro inicial");

  redirect(`/profesionales/registro/gracias?codigo=${codigo}`);
}
