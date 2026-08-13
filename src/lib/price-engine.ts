import { DIAS } from "@/lib/constants";

/// Tipos estructurales, no los de Prisma: así el MISMO cálculo corre en el
/// servidor (autoridad) y en el navegador (precio en vivo mientras el cliente
/// llena el formulario). Un solo motor, cero riesgo de que muestren distinto.
export type ReglaPrecio = {
  codigo: string;
  etiqueta: string;
  tipo: string;
  valor: number;
  campo: string;
  valorEsperado: string;
  umbral: number;
  minutos: number;
  orden: number;
};

export type ServicioPrecio = {
  nombre: string;
  modeloPrecio: string;
  precioBase: number;
  duracionMinMin: number;
  duracionMaxMin: number;
  porcentajeProfesional: number;
  priceRules: ReglaPrecio[];
};

/// Respuestas del cuestionario del cliente. Las llaves son los `campo` de PriceRule.
export type Respuestas = Record<string, string | number | boolean>;

export type LineaCotizacion = {
  codigo: string;
  etiqueta: string;
  monto: number;
  orden: number;
};

export type Cotizacion = {
  modeloPrecio: string;
  lineas: LineaCotizacion[];
  total: number;
  pagoProfesional: number;
  comision: number;
  duracionEstimadaMin: number;
  requiereDiagnostico: boolean;
  advertencias: string[];
};

function comoNumero(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "boolean") return valor ? 1 : 0;
  if (typeof valor === "string") {
    const limpio = valor.trim().toLowerCase();
    if (limpio === "si" || limpio === "sí" || limpio === "true") return 1;
    if (limpio === "no" || limpio === "false" || limpio === "") return 0;
    const n = Number(limpio.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function reglaAplica(regla: ReglaPrecio, respuestas: Respuestas): boolean {
  if (!regla.campo) return false;
  const valor = respuestas[regla.campo];
  if (valor === undefined || valor === null) return false;

  if (regla.valorEsperado) {
    return String(valor).trim().toUpperCase() === regla.valorEsperado.toUpperCase();
  }
  return comoNumero(valor) > regla.umbral;
}

function cantidadDe(regla: ReglaPrecio, respuestas: Respuestas): number {
  return Math.max(0, comoNumero(respuestas[regla.campo]) - regla.umbral);
}

/// Enriquece las respuestas con lo que la plataforma sabe y el cliente no
/// escribe: el día de la semana y la urgencia se cobran, pero no se preguntan
/// dos veces.
export function contextoDeFecha(fechaDeseada: Date | null, urgencia: string): Respuestas {
  const base: Respuestas = { urgencia };
  if (fechaDeseada && !Number.isNaN(fechaDeseada.getTime())) {
    base.dia = DIAS[fechaDeseada.getDay()];
  } else if (urgencia === "AHORA" || urgencia === "HOY") {
    base.dia = DIAS[new Date().getDay()];
  }
  return base;
}

/**
 * §22–§24. Calcula un precio upfront explicable renglón por renglón.
 *
 * Regla del documento maestro: si se puede estandarizar → fijo; si se puede
 * calcular → calculado; si necesita diagnóstico → se cobra el diagnóstico y la
 * cotización real viene después. Nunca se devuelve un rango tipo "$80k–$150k",
 * porque el cliente lee el mínimo como si fuera el precio.
 */
export function cotizar(serviceType: ServicioPrecio, respuestas: Respuestas): Cotizacion {
  if (serviceType.modeloPrecio === "DIAGNOSTICO") {
    const total = serviceType.precioBase;
    const pagoProfesional = Math.round((total * serviceType.porcentajeProfesional) / 100);
    return {
      modeloPrecio: serviceType.modeloPrecio,
      lineas: [
        {
          codigo: "diagnostico",
          etiqueta: serviceType.nombre,
          monto: total,
          orden: 0,
        },
      ],
      total,
      pagoProfesional,
      comision: total - pagoProfesional,
      duracionEstimadaMin: serviceType.duracionMinMin,
      requiereDiagnostico: true,
      advertencias: [
        "El precio final se cotiza después del diagnóstico y requiere aprobación del cliente.",
      ],
    };
  }

  const advertencias: string[] = [];
  const lineas: LineaCotizacion[] = [
    { codigo: "base", etiqueta: serviceType.nombre, monto: serviceType.precioBase, orden: 0 },
  ];

  let duracion = serviceType.duracionMinMin;
  const reglas = [...serviceType.priceRules].sort((a, b) => a.orden - b.orden);

  for (const regla of reglas) {
    if (!reglaAplica(regla, respuestas)) continue;

    let monto = 0;
    if (regla.tipo === "ADICION") {
      monto = regla.valor;
    } else if (regla.tipo === "POR_UNIDAD") {
      const cantidad = cantidadDe(regla, respuestas);
      if (cantidad <= 0) continue;
      monto = regla.valor * cantidad;
      duracion += regla.minutos * cantidad;
    } else if (regla.tipo === "MULTIPLICADOR") {
      const subtotal = lineas.reduce((acc, l) => acc + l.monto, 0);
      monto = Math.round((subtotal * regla.valor) / 100);
    }

    if (regla.tipo !== "POR_UNIDAD") duracion += regla.minutos;
    if (monto === 0) continue;

    lineas.push({ codigo: regla.codigo, etiqueta: regla.etiqueta, monto, orden: regla.orden + 1 });
  }

  const total = lineas.reduce((acc, l) => acc + l.monto, 0);
  const pagoProfesional = Math.round((total * serviceType.porcentajeProfesional) / 100);

  if (duracion > serviceType.duracionMaxMin * 2) {
    advertencias.push(
      "La duración estimada supera al doble del máximo del catálogo: revisar el alcance antes de prometer hora de entrega.",
    );
  }

  return {
    modeloPrecio: serviceType.modeloPrecio,
    lineas,
    total,
    pagoProfesional,
    comision: total - pagoProfesional,
    duracionEstimadaMin: duracion,
    requiereDiagnostico: false,
    advertencias,
  };
}

/// §52: alerta de "precio fuera de rango". Un precio muy lejos del base suele
/// significar cuestionario mal llenado, no un servicio caro.
export function precioFueraDeRango(serviceType: { precioBase: number }, total: number): boolean {
  if (serviceType.precioBase === 0) return false;
  return total > serviceType.precioBase * 3 || total < serviceType.precioBase * 0.5;
}
