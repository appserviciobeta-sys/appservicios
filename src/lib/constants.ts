// Valores válidos de los campos de estado.
// SQLite no soporta enums en Prisma, así que la fuente de verdad vive aquí.

export const URGENCIAS = {
  AHORA: "Ahora",
  HOY: "Hoy",
  PROGRAMADO: "Programado",
  RECURRENTE: "Recurrente",
} as const;

export const CANALES = {
  WEB: "Web",
  WHATSAPP: "WhatsApp",
  LLAMADA: "Llamada",
  REFERIDO: "Referido",
  B2B: "B2B",
} as const;

export const ESTADOS_SOLICITUD = {
  NUEVA: "Nueva",
  CLASIFICADA: "Clasificada",
  COTIZADA: "Cotizada",
  ACEPTADA: "Aceptada",
  ASIGNADA: "Asignada",
  CERRADA: "Cerrada",
  PERDIDA: "Perdida",
} as const;

export const ESTADOS_ORDEN = {
  ASIGNADA: "Asignada",
  CONFIRMADA: "Confirmada",
  EN_CAMINO: "En camino",
  EN_SITIO: "En sitio",
  EN_EJECUCION: "En ejecución",
  EJECUTADA: "Ejecutada",
  CALIFICADA: "Calificada",
  CERRADA: "Cerrada",
  CANCELADA_CLIENTE: "Cancelada por cliente",
  CANCELADA_PROFESIONAL: "Cancelada por profesional",
  NO_SHOW: "No se presentó",
} as const;

/// Órdenes que terminaron bien. Se usa en trust, matching y métricas.
export const ORDENES_COMPLETADAS = ["EJECUTADA", "CALIFICADA", "CERRADA"];
/// Órdenes que rompieron la promesa al cliente.
export const ORDENES_FALLIDAS = ["CANCELADA_PROFESIONAL", "NO_SHOW"];
/// Órdenes vivas: cuentan para carga del profesional y para "servicios activos".
export const ORDENES_ACTIVAS = [
  "ASIGNADA",
  "CONFIRMADA",
  "EN_CAMINO",
  "EN_SITIO",
  "EN_EJECUCION",
];

/// Ya no se elige a mano: lo calcula `estadoPagoDerivado` a partir de los pagos
/// registrados y las liquidaciones giradas. Este mapa solo sirve para mostrarlo.
export const ESTADOS_PAGO = {
  PENDIENTE: "Sin autorizar",
  AUTORIZADO: "Por cobrar",
  PARCIAL: "Abonado",
  COBRADO: "Cobrado",
  LIQUIDADO: "Cobrado y girado",
  REEMBOLSADO: "Reembolsado",
} as const;

export const METODOS_PAGO = {
  TRANSFERENCIA: "Transferencia",
  NEQUI: "Nequi",
  DAVIPLATA: "Daviplata",
  EFECTIVO: "Efectivo",
  PSE: "PSE",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
} as const;

export const ESTADOS_LIQUIDACION = {
  PENDIENTE: "Por girar",
  PAGADO: "Girado",
  ANULADO: "Anulado",
} as const;

export const ESTADOS_PROFESIONAL = {
  BORRADOR: "Borrador",
  EN_VERIFICACION: "En verificación",
  ACTIVO: "Activo",
  SUSPENDIDO: "Suspendido",
  BLOQUEADO: "Bloqueado",
} as const;

export const ESTADOS_CLIENTE = {
  ACTIVO: "Activo",
  EN_REVISION: "En revisión",
  BLOQUEADO: "Bloqueado",
} as const;

export const TIPOS_CLIENTE = {
  PERSONA: "Persona",
  EMPRESA: "Empresa",
} as const;

export const ORIGENES_CLIENTE = {
  WEB_REGISTRO: "Se registró en la web",
  SOLICITUD: "Creado al pedir un servicio",
  WHATSAPP: "WhatsApp",
  REFERIDO: "Referido",
  B2B: "Venta B2B",
} as const;

/// §16: verificado ≠ certificado ≠ declarado.
export const ESTADOS_SKILL = {
  DECLARADA: "Declarada",
  EN_VERIFICACION: "En verificación",
  VERIFICADA: "Verificada",
  CERTIFICADA: "Certificada",
  NO_HABILITADA: "No habilitada",
} as const;

/// Solo estas cuentan para el matching.
export const SKILLS_HABILITADAS = ["VERIFICADA", "CERTIFICADA"];

export const FUENTES_VERIFICACION = {
  EVIDENCIA_FOTO: "Evidencia fotográfica",
  REFERENCIA: "Referencia comprobada",
  PRUEBA_CONOCIMIENTO: "Prueba de conocimiento",
  PRUEBA_PRACTICA: "Prueba práctica",
  CERTIFICADO_ENTIDAD: "Certificado de entidad",
  HISTORIAL_PLATAFORMA: "Historial en la plataforma",
} as const;

export const NIVELES = {
  INICIAL: "Inicial",
  PRO: "Pro",
  EXPERT: "Expert",
  ELITE: "Elite",
} as const;

export const TIPOS_DOCUMENTO = {
  CEDULA: "Cédula",
  RUT: "RUT",
  ARL: "ARL",
  EPS: "EPS",
  CERT_SST: "Certificado SST",
  CERT_TECNICA: "Certificación técnica",
  ANTECEDENTES: "Antecedentes",
  REFERENCIA: "Carta de referencia",
} as const;

/// §48: cada documento debe reducir un riesgo concreto.
export const MOTIVO_DOCUMENTO: Record<string, string> = {
  CEDULA: "Saber quién entra a la casa del cliente",
  RUT: "Soporte fiscal del pago al profesional",
  ARL: "Cobertura si el profesional se accidenta trabajando",
  EPS: "Afiliación vigente a salud",
  CERT_SST: "Reducir accidentes en oficios de riesgo",
  CERT_TECNICA: "Competencia certificada por una entidad",
  ANTECEDENTES: "Riesgo de acceso a vivienda y activos",
  REFERENCIA: "Historial verificable de trabajos previos",
};

export const ESTADOS_DOCUMENTO = {
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  VIGENTE: "Vigente",
  VENCIDO: "Vencido",
  RECHAZADO: "Rechazado",
} as const;

export const TIPOS_INCIDENTE = {
  DANO: "Daño",
  CALIDAD: "Mala calidad",
  COBRO: "Cobro",
  CONDUCTA: "Conducta",
  INCUMPLIMIENTO: "Incumplimiento",
  SEGURIDAD: "Seguridad",
  OTRO: "Otro",
} as const;

export const SEVERIDADES = {
  BAJO: "Bajo",
  MEDIO: "Medio",
  ALTO: "Alto",
} as const;

export const ESTADOS_INCIDENTE = {
  ABIERTO: "Abierto",
  EN_INVESTIGACION: "En investigación",
  RESUELTO: "Resuelto",
  CERRADO_SIN_ACCION: "Cerrado sin acción",
  ESCALADO: "Escalado",
} as const;

export const RESPONSABLES = {
  NINGUNO: "Sin responsable definido",
  PROFESIONAL: "Profesional",
  CLIENTE: "Cliente",
  PLATAFORMA: "Plataforma",
} as const;

export const ESTADOS_MATCH = {
  SUGERIDO: "Sugerido",
  CONTACTADO: "Contactado",
  ACEPTO: "Aceptó",
  RECHAZO: "Rechazó",
  NO_RESPONDIO: "No respondió",
  DESCARTADO: "Descartado",
} as const;

export const MODELOS_PRECIO = {
  FIJO: "Precio fijo",
  CALCULADO: "Precio calculado",
  DIAGNOSTICO: "Diagnóstico + cotización",
} as const;

export const DIAS = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

export function etiqueta(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "—";
  return mapa[valor] ?? valor;
}
