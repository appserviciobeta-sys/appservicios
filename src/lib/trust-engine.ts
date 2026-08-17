import { prisma } from "@/lib/db";
import { ORDENES_COMPLETADAS, ORDENES_FALLIDAS, SKILLS_HABILITADAS } from "@/lib/constants";
import { esImpago } from "@/lib/dinero";

export type ComponenteTrust = {
  clave: string;
  etiqueta: string;
  peso: number;
  valor: number; // 0..1
  aporte: number; // puntos sobre 100
  detalle: string;
};

export type ResultadoTrust = {
  score: number;
  nivel: string;
  componentes: ComponenteTrust[];
  penalizacion: number;
  detallePenalizacion: string;
};

/// §50 Trust Engine. Pesos explícitos: si alguien pregunta por qué su score es
/// 71, la respuesta tiene que ser una tabla, no un modelo opaco.
const PESOS = {
  identidad: 0.15,
  competencia: 0.2,
  calidad: 0.2,
  historial: 0.15,
  puntualidad: 0.1,
  cumplimiento: 0.1,
  formacion: 0.05,
  experiencia: 0.05,
};

/// Un profesional nuevo no es un profesional malo. Sin datos se parte de un
/// valor neutro, no de cero: castigar la ausencia de historial mata el onboarding.
const NEUTRO_SIN_DATOS = 0.6;

export async function calcularTrust(professionalId: string): Promise<ResultadoTrust> {
  const pro = await prisma.professional.findUniqueOrThrow({
    where: { id: professionalId },
    include: {
      skills: true,
      documentos: true,
      ordenes: { include: { calificaciones: true, incidentes: true } },
    },
  });

  const ahora = new Date();
  const docVigente = (tipo: string) =>
    pro.documentos.find(
      (d) => d.tipo === tipo && d.estado === "VIGENTE" && (!d.venceEn || d.venceEn > ahora),
    );

  // --- Identidad -----------------------------------------------------------
  const cedula = pro.documentos.find((d) => d.tipo === "CEDULA");
  const antecedentes = docVigente("ANTECEDENTES");
  let identidad = 0;
  let detalleIdentidad = "Sin documento de identidad cargado";
  if (cedula?.estado === "VIGENTE") {
    identidad = antecedentes ? 1 : 0.8;
    detalleIdentidad = antecedentes
      ? "Cédula vigente + antecedentes verificados"
      : "Cédula vigente, sin antecedentes verificados";
  } else if (cedula && cedula.estado === "EN_REVISION") {
    identidad = 0.4;
    detalleIdentidad = "Cédula en revisión";
  }

  // --- Competencia ---------------------------------------------------------
  const declaradas = pro.skills.filter((s) => s.estado !== "NO_HABILITADA");
  const certificadas = declaradas.filter((s) => s.estado === "CERTIFICADA").length;
  const verificadas = declaradas.filter((s) => s.estado === "VERIFICADA").length;
  const competencia =
    declaradas.length === 0
      ? 0
      : Math.min(1, (certificadas * 1 + verificadas * 0.85) / declaradas.length);
  const detalleCompetencia =
    declaradas.length === 0
      ? "Sin habilidades declaradas"
      : `${certificadas} certificadas y ${verificadas} verificadas de ${declaradas.length} declaradas`;

  // --- Historial -----------------------------------------------------------
  const completadas = pro.ordenes.filter((o) => ORDENES_COMPLETADAS.includes(o.estado));
  const fallidas = pro.ordenes.filter((o) => ORDENES_FALLIDAS.includes(o.estado));
  const historial = Math.min(1, completadas.length / 20);

  // --- Calidad y puntualidad ----------------------------------------------
  const califCliente = pro.ordenes
    .flatMap((o) => o.calificaciones)
    .filter((c) => c.emisor === "CLIENTE");

  const promedio = (valores: (number | null)[]) => {
    const limpios = valores.filter((v): v is number => typeof v === "number");
    if (limpios.length === 0) return null;
    return limpios.reduce((a, b) => a + b, 0) / limpios.length;
  };

  const promCalidad = promedio(califCliente.map((c) => c.calidad));
  const promPuntualidad = promedio(califCliente.map((c) => c.puntualidad));

  const calidad = promCalidad === null ? NEUTRO_SIN_DATOS : promCalidad / 5;
  const puntualidad = promPuntualidad === null ? NEUTRO_SIN_DATOS : promPuntualidad / 5;

  // --- Cumplimiento --------------------------------------------------------
  const totalCerrados = completadas.length + fallidas.length;
  const cumplimiento = totalCerrados === 0 ? 0.8 : Math.max(0, 1 - fallidas.length / totalCerrados);

  // --- Formación -----------------------------------------------------------
  const tieneFormacion = Boolean(docVigente("CERT_TECNICA") || docVigente("CERT_SST"));

  // --- Experiencia ---------------------------------------------------------
  const experiencia = Math.min(1, pro.aniosExperiencia / 8);

  const crudos: Array<Omit<ComponenteTrust, "aporte">> = [
    { clave: "identidad", etiqueta: "Identidad", peso: PESOS.identidad, valor: identidad, detalle: detalleIdentidad },
    { clave: "competencia", etiqueta: "Competencia verificada", peso: PESOS.competencia, valor: competencia, detalle: detalleCompetencia },
    {
      clave: "calidad",
      etiqueta: "Calidad",
      peso: PESOS.calidad,
      valor: calidad,
      detalle:
        promCalidad === null
          ? "Sin calificaciones aún (valor neutro)"
          : `Promedio ${promCalidad.toFixed(1)}/5 en ${califCliente.length} calificaciones`,
    },
    { clave: "historial", etiqueta: "Historial", peso: PESOS.historial, valor: historial, detalle: `${completadas.length} servicios completados` },
    {
      clave: "puntualidad",
      etiqueta: "Puntualidad",
      peso: PESOS.puntualidad,
      valor: puntualidad,
      detalle: promPuntualidad === null ? "Sin datos aún (valor neutro)" : `Promedio ${promPuntualidad.toFixed(1)}/5`,
    },
    {
      clave: "cumplimiento",
      etiqueta: "Cumplimiento",
      peso: PESOS.cumplimiento,
      valor: cumplimiento,
      detalle: `${fallidas.length} cancelaciones o no-shows de ${totalCerrados} servicios`,
    },
    {
      clave: "formacion",
      etiqueta: "Formación",
      peso: PESOS.formacion,
      valor: tieneFormacion ? 1 : 0,
      detalle: tieneFormacion ? "Certificación vigente" : "Sin certificación vigente",
    },
    { clave: "experiencia", etiqueta: "Experiencia declarada", peso: PESOS.experiencia, valor: experiencia, detalle: `${pro.aniosExperiencia} años` },
  ];

  const componentes: ComponenteTrust[] = crudos.map((c) => ({
    ...c,
    aporte: Math.round(c.peso * c.valor * 100),
  }));

  // --- Penalización por incidentes ----------------------------------------
  // Solo cuentan los que se le atribuyeron al profesional: un cliente que
  // reclama sin razón no debe hundirle el score a nadie.
  const incidentes = pro.ordenes
    .flatMap((o) => o.incidentes)
    .filter(
      (i) =>
        i.estado !== "CERRADO_SIN_ACCION" &&
        (i.responsable === "PROFESIONAL" || i.responsable === "NINGUNO"),
    );
  const puntosPorSeveridad: Record<string, number> = { ALTO: 12, MEDIO: 5, BAJO: 1 };
  const penalizacion = Math.min(
    30,
    incidentes.reduce((acc, i) => acc + (puntosPorSeveridad[i.severidad] ?? 1), 0),
  );

  const bruto = componentes.reduce((acc, c) => acc + c.peso * c.valor, 0) * 100;
  const score = Math.max(0, Math.min(100, Math.round(bruto - penalizacion)));

  return {
    score,
    nivel: nivelPara(score, completadas.length),
    componentes,
    penalizacion,
    detallePenalizacion:
      incidentes.length === 0
        ? "Sin incidentes atribuidos"
        : `${incidentes.length} incidentes (${incidentes.filter((i) => i.severidad === "ALTO").length} altos)`,
  };
}

/// §37. El nivel exige score Y volumen: no se asciende con 3 servicios perfectos.
export function nivelPara(score: number, completadas: number): string {
  if (score >= 90 && completadas >= 100) return "ELITE";
  if (score >= 80 && completadas >= 40) return "EXPERT";
  if (score >= 65 && completadas >= 10) return "PRO";
  return "INICIAL";
}

/// Recalcula, persiste y deja snapshot. El score nunca se escribe a mano.
export async function recalcularTrust(professionalId: string, motivo: string) {
  const resultado = await calcularTrust(professionalId);
  const desglose = JSON.stringify({
    componentes: resultado.componentes,
    penalizacion: resultado.penalizacion,
    detallePenalizacion: resultado.detallePenalizacion,
  });

  await prisma.professional.update({
    where: { id: professionalId },
    data: { trustScore: resultado.score, nivel: resultado.nivel, trustDesglose: desglose },
  });

  await prisma.trustSnapshot.create({
    data: { professionalId, score: resultado.score, desglose, motivo },
  });

  return resultado;
}

/// Habilidades que el profesional puede ejercer hoy (§10 + §16).
export function skillsHabilitadas(skills: { skillId: string; estado: string }[]): Set<string> {
  return new Set(skills.filter((s) => SKILLS_HABILITADAS.includes(s.estado)).map((s) => s.skillId));
}

/// §32 Reputación del cliente. Mismo principio que el profesional: se calcula,
/// no se escribe. Un cliente que cancela mucho o reclama sin razón también
/// cuesta plata y hay que poder verlo.
export async function recalcularTrustCliente(clientId: string) {
  const cliente = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: {
      ordenes: { include: { incidentes: true, calificaciones: true } },
      requests: true,
    },
  });

  const completadas = cliente.ordenes.filter((o) => ORDENES_COMPLETADAS.includes(o.estado)).length;
  const canceladas = cliente.ordenes.filter((o) => o.estado === "CANCELADA_CLIENTE").length;
  const totalOrdenes = completadas + canceladas;

  const incidentesCulpaCliente = cliente.ordenes
    .flatMap((o) => o.incidentes)
    .filter((i) => i.responsable === "CLIENTE").length;

  const impagos = cliente.ordenes.filter(
    (o) => ORDENES_COMPLETADAS.includes(o.estado) && esImpago(o),
  ).length;

  const califDadas = cliente.ordenes
    .flatMap((o) => o.calificaciones)
    .filter((c) => c.emisor === "PROFESIONAL" && typeof c.comunicacion === "number");
  const promTrato =
    califDadas.length === 0
      ? null
      : califDadas.reduce((a, c) => a + (c.comunicacion ?? 0), 0) / califDadas.length;

  let score = 70;
  if (totalOrdenes > 0) score += Math.round(Math.min(15, completadas * 1.5));
  if (totalOrdenes > 0) score -= Math.round((canceladas / totalOrdenes) * 25);
  score -= incidentesCulpaCliente * 10;
  score -= impagos * 8;
  if (promTrato !== null) score += Math.round((promTrato - 3) * 4);

  const final = Math.max(0, Math.min(100, score));

  await prisma.client.update({ where: { id: clientId }, data: { trustScore: final } });
  return final;
}
