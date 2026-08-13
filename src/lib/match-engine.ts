import { prisma } from "@/lib/db";
import { ORDENES_ACTIVAS, ORDENES_COMPLETADAS, ORDENES_FALLIDAS } from "@/lib/constants";
import { skillsHabilitadas } from "@/lib/trust-engine";

export type FactorMatch = {
  clave: string;
  etiqueta: string;
  maximo: number;
  puntos: number;
  detalle: string;
};

export type Candidato = {
  professionalId: string;
  nombre: string;
  nivel: string;
  trustScore: number;
  celular: string;
  score: number;
  factores: FactorMatch[];
  descartado: boolean;
  motivo: string;
};

/// §21. Pesos del match. No gana el mejor rating: gana el mejor profesional
/// para ESE trabajo. Por eso las habilidades y el historial en ese tipo de
/// servicio pesan más que la reputación global.
const MAX = {
  skills: 30,
  trust: 22,
  zona: 14,
  historialTipo: 12,
  puntualidad: 10,
  disponibilidad: 8,
  carga: 4,
};

const PENALIZACION_MAX = 25;

function zonasDe(texto: string): string[] {
  return texto
    .split(",")
    .map((z) => z.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Calcula y persiste los candidatos de una solicitud.
 *
 * Se guardan también los descartados y su motivo: saber por qué NO hubo match
 * es lo que revela dónde falta oferta, qué habilidad escasea y en qué zona no
 * se puede prometer reemplazo (§35, §53).
 */
export async function calcularCandidatos(requestId: string): Promise<Candidato[]> {
  const solicitud = await prisma.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { client: true, serviceType: { include: { skills: true } } },
  });

  if (!solicitud.serviceType) {
    throw new Error(
      "La solicitud debe estar clasificada en un tipo de servicio antes de buscar match.",
    );
  }

  const skillsObligatorias = solicitud.serviceType.skills
    .filter((s) => s.obligatoria)
    .map((s) => s.skillId);
  const skillsOpcionales = solicitud.serviceType.skills
    .filter((s) => !s.obligatoria)
    .map((s) => s.skillId);

  const ciudad = solicitud.client.ciudad || "";
  const profesionales = await prisma.professional.findMany({
    where: { estado: "ACTIVO", ...(ciudad ? { ciudad } : {}) },
    include: {
      skills: true,
      disponibilidad: true,
      ordenes: { include: { calificaciones: true, incidentes: true } },
    },
  });

  const zonaSolicitud = (solicitud.zona || solicitud.client.zona || "").trim().toLowerCase();
  const fecha = solicitud.fechaDeseada;

  const candidatos: Candidato[] = profesionales.map((pro) => {
    const habilitadas = skillsHabilitadas(pro.skills);
    const factores: FactorMatch[] = [];

    // --- Skills: el filtro duro ------------------------------------------
    const faltantes = skillsObligatorias.filter((id) => !habilitadas.has(id));
    const opcionalesCubiertas = skillsOpcionales.filter((id) => habilitadas.has(id)).length;

    if (faltantes.length > 0) {
      return {
        professionalId: pro.id,
        nombre: pro.nombre,
        nivel: pro.nivel,
        trustScore: pro.trustScore,
        celular: pro.celular,
        score: 0,
        factores: [],
        descartado: true,
        motivo: `Le faltan ${faltantes.length} habilidades obligatorias verificadas`,
      };
    }

    const bonoOpcionales =
      skillsOpcionales.length === 0 ? 5 : (opcionalesCubiertas / skillsOpcionales.length) * 5;
    factores.push({
      clave: "skills",
      etiqueta: "Habilidades requeridas",
      maximo: MAX.skills,
      puntos: Math.round(Math.min(MAX.skills, MAX.skills - 5 + bonoOpcionales)),
      detalle: `Cubre las ${skillsObligatorias.length} obligatorias${
        skillsOpcionales.length
          ? ` y ${opcionalesCubiertas}/${skillsOpcionales.length} opcionales`
          : ""
      }`,
    });

    // --- Trust global ------------------------------------------------------
    factores.push({
      clave: "trust",
      etiqueta: "Trust Score",
      maximo: MAX.trust,
      puntos: Math.round((pro.trustScore / 100) * MAX.trust),
      detalle: `Trust ${pro.trustScore}/100 · nivel ${pro.nivel}`,
    });

    // --- Zona --------------------------------------------------------------
    const zonasPro = zonasDe(pro.zonas);
    let puntosZona = 0;
    let detalleZona = "Sin zona declarada";
    if (!zonaSolicitud) {
      puntosZona = Math.round(MAX.zona * 0.5);
      detalleZona = "La solicitud no tiene zona: no se puede priorizar por cercanía";
    } else if (zonasPro.includes(zonaSolicitud)) {
      puntosZona = MAX.zona;
      detalleZona = `Opera en ${solicitud.zona || solicitud.client.zona}`;
    } else if (zonasPro.length > 0) {
      puntosZona = Math.round(MAX.zona * 0.3);
      detalleZona = `No opera en ${solicitud.zona || solicitud.client.zona}, pero sí en ${zonasPro.length} zonas de la ciudad`;
    }
    factores.push({
      clave: "zona",
      etiqueta: "Zona",
      maximo: MAX.zona,
      puntos: puntosZona,
      detalle: detalleZona,
    });

    // --- Historial en ESTE tipo de servicio --------------------------------
    const completadas = pro.ordenes.filter((o) => ORDENES_COMPLETADAS.includes(o.estado));
    const enEsteTipo = completadas.filter((o) => o.serviceTypeId === solicitud.serviceTypeId).length;
    factores.push({
      clave: "historialTipo",
      etiqueta: "Experiencia en este servicio",
      maximo: MAX.historialTipo,
      puntos: Math.round(Math.min(1, enEsteTipo / 10) * MAX.historialTipo),
      detalle: `${enEsteTipo} servicios de este tipo (${completadas.length} en total)`,
    });

    // --- Puntualidad -------------------------------------------------------
    const puntualidades = completadas
      .flatMap((o) => o.calificaciones)
      .filter((c) => c.emisor === "CLIENTE" && typeof c.puntualidad === "number")
      .map((c) => c.puntualidad as number);
    const promPuntualidad =
      puntualidades.length === 0
        ? null
        : puntualidades.reduce((a, b) => a + b, 0) / puntualidades.length;
    factores.push({
      clave: "puntualidad",
      etiqueta: "Puntualidad",
      maximo: MAX.puntualidad,
      puntos: Math.round(((promPuntualidad ?? 3.5) / 5) * MAX.puntualidad),
      detalle:
        promPuntualidad === null ? "Sin historial (valor neutro)" : `${promPuntualidad.toFixed(1)}/5`,
    });

    // --- Disponibilidad ----------------------------------------------------
    let puntosDisp = Math.round(MAX.disponibilidad * 0.5);
    let detalleDisp = "Disponibilidad no declarada";
    if (fecha && pro.disponibilidad.length > 0) {
      const minutos = fecha.getHours() * 60 + fecha.getMinutes();
      const cabe = pro.disponibilidad.some(
        (d) => d.diaSemana === fecha.getDay() && d.horaInicio <= minutos && d.horaFin >= minutos,
      );
      puntosDisp = cabe ? MAX.disponibilidad : 0;
      detalleDisp = cabe ? "Disponible en la franja pedida" : "Fuera de su franja declarada";
    } else if (solicitud.urgencia === "AHORA" || solicitud.urgencia === "HOY") {
      detalleDisp = "Urgencia inmediata: hay que confirmar por WhatsApp";
    }
    factores.push({
      clave: "disponibilidad",
      etiqueta: "Disponibilidad",
      maximo: MAX.disponibilidad,
      puntos: puntosDisp,
      detalle: detalleDisp,
    });

    // --- Carga actual ------------------------------------------------------
    const activas = pro.ordenes.filter((o) => ORDENES_ACTIVAS.includes(o.estado)).length;
    factores.push({
      clave: "carga",
      etiqueta: "Carga actual",
      maximo: MAX.carga,
      puntos: activas === 0 ? MAX.carga : activas <= 2 ? 2 : 0,
      detalle: `${activas} servicios activos`,
    });

    // --- Penalizaciones ----------------------------------------------------
    const fallidas = pro.ordenes.filter((o) => ORDENES_FALLIDAS.includes(o.estado)).length;
    const totalCerrados = completadas.length + fallidas;
    const tasaFalla = totalCerrados === 0 ? 0 : fallidas / totalCerrados;
    const incidentesAltos = pro.ordenes
      .flatMap((o) => o.incidentes)
      .filter(
        (i) =>
          i.severidad === "ALTO" &&
          i.estado !== "CERRADO_SIN_ACCION" &&
          i.responsable !== "CLIENTE",
      ).length;

    const penalizacion = Math.min(
      PENALIZACION_MAX,
      Math.round(tasaFalla * 15 + incidentesAltos * 8),
    );
    if (penalizacion > 0) {
      factores.push({
        clave: "penalizacion",
        etiqueta: "Penalización",
        maximo: 0,
        puntos: -penalizacion,
        detalle: `${fallidas} cancelaciones/no-shows · ${incidentesAltos} incidentes altos`,
      });
    }

    const score = Math.max(0, Math.min(100, factores.reduce((acc, f) => acc + f.puntos, 0)));

    return {
      professionalId: pro.id,
      nombre: pro.nombre,
      nivel: pro.nivel,
      trustScore: pro.trustScore,
      celular: pro.celular,
      score,
      factores,
      descartado: false,
      motivo: "",
    };
  });

  candidatos.sort((a, b) => b.score - a.score);

  // Persistir para poder auditar el matching después (§53).
  for (const c of candidatos) {
    await prisma.matchCandidate.upsert({
      where: { requestId_professionalId: { requestId, professionalId: c.professionalId } },
      create: {
        requestId,
        professionalId: c.professionalId,
        score: c.score,
        desglose: JSON.stringify(c.factores),
        estado: c.descartado ? "DESCARTADO" : "SUGERIDO",
        motivo: c.motivo,
      },
      update: {
        score: c.score,
        desglose: JSON.stringify(c.factores),
        motivo: c.motivo,
      },
    });
  }

  return candidatos;
}
