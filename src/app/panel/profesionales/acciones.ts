"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { registrarEvento } from "@/lib/events";
import { fallar } from "@/lib/errores";
import { MOTIVO_DOCUMENTO } from "@/lib/constants";
import { recalcularTrust } from "@/lib/trust-engine";

function ruta(id: string) {
  return `/panel/profesionales/${id}`;
}

export async function verificarSkill(formData: FormData) {
  const skillProId = String(formData.get("skillProId"));
  const estado = String(formData.get("estado"));
  const fuente = String(formData.get("fuente") ?? "");
  const nota = String(formData.get("nota") ?? "");

  const actual = await prisma.professionalSkill.findUniqueOrThrow({
    where: { id: skillProId },
    include: { skill: true },
  });

  // Verificar sin decir cómo se comprobó es exactamente lo que el §16 prohíbe:
  // sin fuente, "verificada" no significa nada.
  if (["VERIFICADA", "CERTIFICADA"].includes(estado) && !fuente) {
    fallar(ruta(actual.professionalId), "Para verificar una habilidad hay que decir cómo se comprobó.");
  }
  if (estado === "CERTIFICADA" && fuente !== "CERTIFICADO_ENTIDAD") {
    fallar(
      ruta(actual.professionalId),
      "Certificada solo aplica cuando hay certificado de una entidad. Si la comprobaste tú, es verificada.",
    );
  }
  if (actual.skill.requiereCertificacion && estado === "VERIFICADA") {
    fallar(
      ruta(actual.professionalId),
      `${actual.skill.nombre} es de alto riesgo: necesita certificación de entidad, no basta con verificarla.`,
    );
  }

  const registro = await prisma.professionalSkill.update({
    where: { id: skillProId },
    data: {
      estado,
      fuente,
      nota,
      verificadoPor: ["VERIFICADA", "CERTIFICADA"].includes(estado) ? "operador" : null,
      verificadoEn: ["VERIFICADA", "CERTIFICADA"].includes(estado) ? new Date() : null,
    },
    include: { skill: true },
  });

  await registrarEvento({
    entidad: "Professional",
    entidadId: registro.professionalId,
    tipo: "SKILL_ACTUALIZADA",
    payload: { skill: registro.skill.slug, estado, fuente },
  });

  await recalcularTrust(registro.professionalId, `Habilidad ${registro.skill.slug} → ${estado}`);
  redirect(ruta(registro.professionalId));
}

export async function actualizarDocumento(formData: FormData) {
  const documentoId = String(formData.get("documentoId"));
  const estado = String(formData.get("estado"));
  const vence = String(formData.get("venceEn") ?? "");

  const documento = await prisma.professionalDocument.update({
    where: { id: documentoId },
    data: {
      estado,
      venceEn: vence ? new Date(vence) : null,
      verificadoPor: estado === "VIGENTE" ? "operador" : null,
      verificadoEn: estado === "VIGENTE" ? new Date() : null,
    },
  });

  await registrarEvento({
    entidad: "Professional",
    entidadId: documento.professionalId,
    tipo: "DOCUMENTO_ACTUALIZADO",
    payload: { tipo: documento.tipo, estado },
  });

  await recalcularTrust(documento.professionalId, `Documento ${documento.tipo} → ${estado}`);
  redirect(ruta(documento.professionalId));
}

export async function agregarDocumento(formData: FormData) {
  const professionalId = String(formData.get("professionalId"));
  const tipo = String(formData.get("tipo"));

  const existente = await prisma.professionalDocument.findFirst({ where: { professionalId, tipo } });
  if (!existente) {
    await prisma.professionalDocument.create({
      data: {
        professionalId,
        tipo,
        // §48: sin motivo de riesgo no se pide el documento.
        motivoRiesgo: MOTIVO_DOCUMENTO[tipo] ?? "Reducción de riesgo",
        estado: "PENDIENTE",
      },
    });
  }

  redirect(ruta(professionalId));
}

export async function cambiarEstadoProfesional(formData: FormData) {
  const professionalId = String(formData.get("professionalId"));
  const estado = String(formData.get("estado"));

  if (estado === "ACTIVO") {
    // Nadie entra a una casa sin identidad verificada. Este control es el
    // mínimo no negociable del §17.
    const cedula = await prisma.professionalDocument.findFirst({
      where: { professionalId, tipo: "CEDULA", estado: "VIGENTE" },
    });
    if (!cedula) {
      fallar(ruta(professionalId), "No se puede activar sin cédula verificada como vigente.");
    }
    const verificadas = await prisma.professionalSkill.count({
      where: { professionalId, estado: { in: ["VERIFICADA", "CERTIFICADA"] } },
    });
    if (verificadas === 0) {
      fallar(ruta(professionalId), "No se puede activar sin al menos una habilidad verificada.");
    }
  }

  await prisma.professional.update({ where: { id: professionalId }, data: { estado } });

  await registrarEvento({
    entidad: "Professional",
    entidadId: professionalId,
    tipo: "ESTADO_PROFESIONAL",
    payload: { estado },
  });

  await recalcularTrust(professionalId, `Estado → ${estado}`);
  redirect(ruta(professionalId));
}

export async function guardarNotasProfesional(formData: FormData) {
  const professionalId = String(formData.get("professionalId"));
  const notas = String(formData.get("notasInternas") ?? "");
  const zonas = String(formData.get("zonas") ?? "");

  await prisma.professional.update({
    where: { id: professionalId },
    data: { notasInternas: notas, ...(zonas ? { zonas } : {}) },
  });

  redirect(ruta(professionalId));
}
