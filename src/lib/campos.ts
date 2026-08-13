import type { ReglaPrecio } from "@/lib/price-engine";

/// Preguntas del cuestionario. El formulario NO está escrito a mano: se deriva
/// de las reglas de precio del catálogo. Si mañana se agrega un servicio con
/// una regla nueva, la pregunta aparece sola.
export type DefinicionCampo = {
  etiqueta: string;
  tipo: "numero" | "booleano";
  ayuda?: string;
  min?: number;
  max?: number;
  defecto?: number;
};

/// Campos que la plataforma deduce (día, urgencia). No se le preguntan al
/// cliente dos veces: ya los eligió en el paso de tiempo.
export const CAMPOS_CONTEXTUALES = ["dia", "urgencia"];

export const CAMPOS: Record<string, DefinicionCampo> = {
  area: {
    etiqueta: "Área aproximada (m²)",
    tipo: "numero",
    ayuda: "Si no la sabes exacta, un estimado sirve.",
    min: 10,
    max: 1000,
    defecto: 70,
  },
  banos: { etiqueta: "Número de baños", tipo: "numero", min: 0, max: 10, defecto: 1 },
  horno: { etiqueta: "Limpieza de horno", tipo: "booleano" },
  ventanas: { etiqueta: "Ventanas por dentro y por fuera", tipo: "booleano" },
  puntos: {
    etiqueta: "Cantidad de puntos",
    tipo: "numero",
    ayuda: "Cuántos puntos hay que intervenir en total.",
    min: 1,
    max: 30,
    defecto: 1,
  },
  punto_nuevo: {
    etiqueta: "Hay que crear un punto eléctrico nuevo",
    tipo: "booleano",
    ayuda: "Marca esto si en el sitio no existe salida eléctrica.",
  },
  poda: { etiqueta: "Incluir poda de árboles", tipo: "booleano" },
  retiro: { etiqueta: "Retiro de residuos vegetales", tipo: "booleano" },
  habitaciones: { etiqueta: "Número de habitaciones", tipo: "numero", min: 1, max: 15, defecto: 1 },
  resane: { etiqueta: "Requiere resane y estuco", tipo: "booleano" },
  techo: { etiqueta: "Incluir techo", tipo: "booleano" },
  unidades: {
    etiqueta: "Cantidad de unidades a instalar",
    tipo: "numero",
    min: 1,
    max: 20,
    defecto: 1,
  },
};

export type CampoRenderizable = DefinicionCampo & { nombre: string };

/// Devuelve las preguntas visibles para un servicio, sin repetir campos.
export function camposDe(reglas: ReglaPrecio[]): CampoRenderizable[] {
  const vistos = new Set<string>();
  const salida: CampoRenderizable[] = [];

  for (const regla of [...reglas].sort((a, b) => a.orden - b.orden)) {
    const nombre = regla.campo;
    if (!nombre || vistos.has(nombre)) continue;
    if (CAMPOS_CONTEXTUALES.includes(nombre)) continue;

    const definicion = CAMPOS[nombre];
    if (!definicion) continue; // regla operada a mano desde el panel

    vistos.add(nombre);
    salida.push({ ...definicion, nombre });
  }

  return salida;
}

/// Valores iniciales del formulario para un servicio.
export function valoresIniciales(campos: CampoRenderizable[]): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const campo of campos) {
    salida[campo.nombre] = campo.tipo === "booleano" ? "0" : String(campo.defecto ?? campo.min ?? 0);
  }
  return salida;
}
