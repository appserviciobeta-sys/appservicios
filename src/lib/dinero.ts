/**
 * La cuenta de un servicio: qué se cobró, qué falta y qué se le debe a quien
 * hizo el trabajo.
 *
 * Todo en pesos enteros. Nunca decimales: `0.1 + 0.2` no da `0.3` en punto
 * flotante, y una diferencia de un peso que se repite mil veces es una
 * descuadrada de mil pesos que nadie va a poder explicar en tres meses.
 *
 * Las funciones de este archivo no tocan la base a propósito — reciben los
 * datos ya cargados. Así se pueden probar sin conexión, que es exactamente lo
 * que hace `npm run verificar-dinero`.
 */

export type PagoBase = { monto: number; estado: string };

/// Lo que efectivamente entró. Los reversados no cuentan: el dinero volvió.
export function totalCobrado(pagos: PagoBase[]): number {
  return pagos
    .filter((p) => p.estado === "CONFIRMADO")
    .reduce((suma, p) => suma + p.monto, 0);
}

export type Cuenta = {
  total: number;
  cobrado: number;
  saldo: number;
  completo: boolean;
  /// Cobrado de más. Pasa con abonos mal digitados y hay que verlo, no
  /// esconderlo: un saldo negativo es plata que hay que devolver.
  excedente: number;
};

export function cuentaDeOrden(precioCliente: number, pagos: PagoBase[]): Cuenta {
  const cobrado = totalCobrado(pagos);
  const saldo = precioCliente - cobrado;
  return {
    total: precioCliente,
    cobrado,
    saldo: Math.max(0, saldo),
    completo: cobrado >= precioCliente && precioCliente > 0,
    excedente: Math.max(0, -saldo),
  };
}

/**
 * §30 — el cliente cierra el servicio, no el profesional.
 *
 * Mientras no confirme que quedó bien, no hay nada que cobrar. Esto no es una
 * cortesía: es lo que hace que la garantía signifique algo. Si se pudiera
 * cobrar antes de la confirmación, el incentivo de resolver un reclamo se cae.
 */
export function sePuedeCobrar(orden: {
  estado: string;
  confirmadoClienteAt: Date | null;
  confirmacionCliente: string;
}): boolean {
  if (orden.estado.startsWith("CANCELADA") || orden.estado === "NO_SHOW") return false;
  return orden.confirmadoClienteAt != null && orden.confirmacionCliente === "OK";
}

/**
 * El estado de pago se calcula, no se escribe.
 *
 * Antes era un desplegable que el operador movía a mano, y por eso podía decir
 * "COBRADO" sin que hubiera entrado un peso. Ahora sale de los hechos: los
 * pagos registrados y las liquidaciones giradas. La etiqueta no puede mentir
 * porque ya no hay forma de ponerla.
 */
export function estadoPagoDerivado(
  orden: {
    estado: string;
    precioCliente: number;
    confirmadoClienteAt: Date | null;
    confirmacionCliente: string;
  },
  pagos: PagoBase[],
  liquidado: boolean,
): string {
  const hubo = pagos.some((p) => p.estado === "CONFIRMADO");
  const reversados = pagos.some((p) => p.estado === "REVERSADO");

  // Se devolvió todo lo que había entrado: el servicio quedó en cero.
  if (!hubo && reversados) return "REEMBOLSADO";

  const { completo } = cuentaDeOrden(orden.precioCliente, pagos);

  if (completo && liquidado) return "LIQUIDADO";
  if (completo) return "COBRADO";
  if (hubo) return "PARCIAL";
  if (sePuedeCobrar(orden)) return "AUTORIZADO";
  return "PENDIENTE";
}

export type OrdenLiquidable = {
  id: string;
  codigo: string;
  pagoProfesional: number;
  precioCliente: number;
  checkOutAt: Date | null;
  pagos: PagoBase[];
  liquidaciones: { id: string }[];
};

/**
 * Qué se le puede girar hoy a un profesional.
 *
 * La regla por defecto es no liquidar lo que no se ha cobrado. No es tacañería:
 * girar contra plata que todavía no entró es exactamente cómo un negocio con
 * márgenes de comisión se queda sin caja sin darse cuenta.
 *
 * Se devuelven también las pendientes por cobrar, marcadas aparte, porque a
 * veces se decide adelantar el pago para no perder a un buen profesional. Esa
 * es una decisión de negocio con la información al frente, no un descuido.
 */
export function separarLiquidables(ordenes: OrdenLiquidable[]) {
  // Ya está en un giro: no puede entrar en otro.
  const sinGirar = ordenes.filter((o) => o.liquidaciones.length === 0);

  const listas = sinGirar.filter((o) => cuentaDeOrden(o.precioCliente, o.pagos).completo);
  const sinCobrar = sinGirar.filter((o) => !cuentaDeOrden(o.precioCliente, o.pagos).completo);

  return {
    listas,
    sinCobrar,
    totalListas: listas.reduce((s, o) => s + o.pagoProfesional, 0),
    totalSinCobrar: sinCobrar.reduce((s, o) => s + o.pagoProfesional, 0),
  };
}

/// Tres días de gracia: si el operador todavía no ha registrado el cobro, el
/// que va atrasado es el piloto, no el cliente.
export const GRACIA_IMPAGO_MS = 3 * 24 * 3600 * 1000;

/**
 * ¿Este servicio quedó debiéndose?
 *
 * OJO con el estado que se mira. Cuando el pago se marcaba a mano, "PENDIENTE"
 * quería decir "no ha pagado". Con los estados derivados significa otra cosa:
 * "el cliente todavía no ha confirmado el trabajo", y en ese caso no hay nada
 * que deber — ni siquiera se puede cobrar.
 *
 * La deuda real vive en AUTORIZADO (confirmó y no ha pagado nada) y en PARCIAL
 * (abonó y quedó debiendo). Seguir mirando PENDIENTE castigaba al cliente por
 * no haber pagado algo que el sistema no le dejaba pagar.
 */
export function esImpago(
  orden: { estadoPago: string; updatedAt: Date },
  ahora: number = Date.now(),
): boolean {
  if (!["AUTORIZADO", "PARCIAL"].includes(orden.estadoPago)) return false;
  return ahora - orden.updatedAt.getTime() > GRACIA_IMPAGO_MS;
}

/// La comisión real, no la teórica: sobre lo que efectivamente entró.
///
/// El margen proyectado del catálogo y el margen que quedó en la cuenta son
/// dos números distintos, y confundirlos es cómo se cree que un negocio va
/// bien cuando no.
export function margenReal(
  ordenes: { precioCliente: number; pagoProfesional: number; costoMateriales: number; pagos: PagoBase[] }[],
) {
  const cobrado = ordenes.reduce((s, o) => s + totalCobrado(o.pagos), 0);
  const aProfesionales = ordenes.reduce((s, o) => s + o.pagoProfesional, 0);
  const materiales = ordenes.reduce((s, o) => s + o.costoMateriales, 0);
  const bruto = cobrado - aProfesionales - materiales;

  return {
    cobrado,
    aProfesionales,
    materiales,
    bruto,
    porcentaje: cobrado === 0 ? 0 : Math.round((bruto / cobrado) * 100),
  };
}
