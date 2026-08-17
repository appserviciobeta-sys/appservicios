"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requerirOperador } from "@/lib/auth";
import { registrarEvento } from "@/lib/events";
import { fallar } from "@/lib/errores";
import { cuentaDeOrden, sePuedeCobrar } from "@/lib/dinero";
import { recalcularEstadoPago, siguienteCodigoLiquidacion } from "@/lib/pagos";

const RUTA = "/panel/dinero";

const Cobro = z.object({
  ordenId: z.string().min(1),
  monto: z.coerce.number().int().positive("El monto debe ser mayor que cero."),
  metodo: z.string().min(1),
  referencia: z.string().trim().max(120).default(""),
  notas: z.string().trim().max(500).default(""),
  volverA: z.string().default(RUTA),
});

/// Registrar que entró plata. Es el hecho; el estado de la orden se recalcula
/// solo a partir de él.
export async function registrarCobro(formData: FormData) {
  // Los server actions se invocan por HTTP: el guardia del layout no los cubre.
  const operador = await requerirOperador();

  const parseado = Cobro.safeParse(Object.fromEntries(formData));
  if (!parseado.success) {
    fallar(RUTA, parseado.error.issues[0]?.message ?? "Revisa los datos del cobro.");
  }

  const { ordenId, monto, metodo, referencia, notas, volverA } = parseado.data;

  const orden = await prisma.serviceOrder.findUnique({
    where: { id: ordenId },
    include: { pagos: { select: { monto: true, estado: true } } },
  });
  if (!orden) fallar(volverA, "Ese servicio no existe.");

  // §30 — sin el visto bueno del cliente no hay nada que cobrar. Bloquearlo
  // aquí y no solo en la interfaz: esta acción se puede invocar por HTTP.
  if (!sePuedeCobrar(orden)) {
    fallar(
      volverA,
      "Este servicio todavía no lo ha confirmado el cliente. No se puede cobrar aún.",
    );
  }

  const cuenta = cuentaDeOrden(orden.precioCliente, orden.pagos);
  if (monto > cuenta.saldo) {
    fallar(
      volverA,
      `Ese monto supera el saldo pendiente, que es ${cuenta.saldo.toLocaleString("es-CO")}. Revisa antes de registrarlo.`,
    );
  }

  await prisma.payment.create({
    data: {
      serviceOrderId: ordenId,
      monto,
      metodo,
      referencia,
      notas,
      registradoPor: operador.email,
    },
  });

  const estado = await recalcularEstadoPago(ordenId);

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: ordenId,
    tipo: "COBRO_REGISTRADO",
    actor: operador.email,
    payload: { monto, metodo, referencia, estadoResultante: estado },
  });

  redirect(`${volverA}?ok=${encodeURIComponent("Cobro registrado.")}`);
}

/// Reversar en vez de borrar: un cobro que desaparece sin rastro es justo lo
/// que hace imposible auditar una caja.
export async function reversarCobro(formData: FormData) {
  const operador = await requerirOperador();

  const pagoId = String(formData.get("pagoId"));
  const volverA = String(formData.get("volverA") || RUTA);
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (motivo.length < 5) fallar(volverA, "Escribe por qué se reversa el cobro.");

  const pago = await prisma.payment.findUnique({ where: { id: pagoId } });
  if (!pago) fallar(volverA, "Ese cobro no existe.");
  if (pago.estado !== "CONFIRMADO") fallar(volverA, "Ese cobro ya estaba reversado.");

  await prisma.payment.update({
    where: { id: pagoId },
    data: { estado: "REVERSADO", notas: `${pago.notas} · Reversado: ${motivo}`.trim() },
  });

  await recalcularEstadoPago(pago.serviceOrderId);

  await registrarEvento({
    entidad: "ServiceOrder",
    entidadId: pago.serviceOrderId,
    tipo: "COBRO_REVERSADO",
    actor: operador.email,
    payload: { pagoId, monto: pago.monto, motivo },
  });

  redirect(`${volverA}?ok=${encodeURIComponent("Cobro reversado.")}`);
}

/**
 * Arma el giro de un profesional con todo lo que tenga listo.
 *
 * Nace en PENDIENTE, no en PAGADO: crear la liquidación y hacer la
 * transferencia son dos momentos distintos, y darlos por simultáneos es cómo
 * se termina con giros marcados que nunca salieron del banco.
 */
export async function crearLiquidacion(formData: FormData) {
  const operador = await requerirOperador();

  const professionalId = String(formData.get("professionalId"));
  // Marcado explícito por el operador cuando decide adelantar plata que
  // todavía no ha cobrado. No es el camino normal y por eso hay que pedirlo.
  const incluirSinCobrar = formData.get("incluirSinCobrar") === "si";

  const profesional = await prisma.professional.findUnique({
    where: { id: professionalId },
    select: { id: true, nombre: true },
  });
  if (!profesional) fallar(RUTA, "Ese profesional no existe.");

  const ordenes = await prisma.serviceOrder.findMany({
    where: {
      professionalId,
      estado: { in: ["EJECUTADA", "CALIFICADA", "CERRADA"] },
      confirmacionCliente: "OK",
      liquidaciones: { none: { payout: { estado: { not: "ANULADO" } } } },
    },
    include: { pagos: { select: { monto: true, estado: true } } },
  });

  const elegibles = ordenes.filter((o) => {
    if (o.pagoProfesional <= 0) return false;
    return incluirSinCobrar || cuentaDeOrden(o.precioCliente, o.pagos).completo;
  });

  if (elegibles.length === 0) {
    fallar(RUTA, `${profesional.nombre} no tiene servicios listos para girar.`);
  }

  const monto = elegibles.reduce((s, o) => s + o.pagoProfesional, 0);
  const codigo = await siguienteCodigoLiquidacion();

  await prisma.payout.create({
    data: {
      codigo,
      professionalId,
      monto,
      registradoPor: operador.email,
      items: {
        create: elegibles.map((o) => ({ serviceOrderId: o.id, monto: o.pagoProfesional })),
      },
    },
  });

  await registrarEvento({
    entidad: "Professional",
    entidadId: professionalId,
    tipo: "LIQUIDACION_CREADA",
    actor: operador.email,
    payload: { codigo, monto, servicios: elegibles.length, incluirSinCobrar },
  });

  redirect(
    `${RUTA}?ok=${encodeURIComponent(`${codigo} creada por ${monto.toLocaleString("es-CO")} · ${elegibles.length} servicios.`)}`,
  );
}

/// La plata salió del banco. Aquí es donde la orden pasa a LIQUIDADO.
export async function marcarGirada(formData: FormData) {
  const operador = await requerirOperador();

  const payoutId = String(formData.get("payoutId"));
  const metodo = String(formData.get("metodo") || "TRANSFERENCIA");
  const referencia = String(formData.get("referencia") ?? "").trim();

  if (referencia.length < 3) {
    fallar(
      RUTA,
      "Pon la referencia de la transferencia. Sin eso no se puede cuadrar contra el banco.",
    );
  }

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { items: { select: { serviceOrderId: true } } },
  });
  if (!payout) fallar(RUTA, "Esa liquidación no existe.");
  if (payout.estado !== "PENDIENTE") fallar(RUTA, "Esa liquidación ya fue resuelta.");

  await prisma.payout.update({
    where: { id: payoutId },
    data: { estado: "PAGADO", pagadoAt: new Date(), metodo, referencia },
  });

  for (const item of payout.items) {
    await recalcularEstadoPago(item.serviceOrderId);
  }

  await registrarEvento({
    entidad: "Professional",
    entidadId: payout.professionalId,
    tipo: "LIQUIDACION_GIRADA",
    actor: operador.email,
    payload: { codigo: payout.codigo, monto: payout.monto, metodo, referencia },
  });

  redirect(`${RUTA}?ok=${encodeURIComponent(`${payout.codigo} marcada como girada.`)}`);
}

/// Anular libera los servicios para que entren en otro giro. Solo antes de
/// pagar: después de girada, lo que hay es un reverso, no una anulación.
export async function anularLiquidacion(formData: FormData) {
  const operador = await requerirOperador();

  const payoutId = String(formData.get("payoutId"));
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });

  if (!payout) fallar(RUTA, "Esa liquidación no existe.");
  if (payout.estado === "PAGADO") {
    fallar(RUTA, "Esa liquidación ya se giró. No se puede anular una transferencia hecha.");
  }

  await prisma.payout.update({ where: { id: payoutId }, data: { estado: "ANULADO" } });

  await registrarEvento({
    entidad: "Professional",
    entidadId: payout.professionalId,
    tipo: "LIQUIDACION_ANULADA",
    actor: operador.email,
    payload: { codigo: payout.codigo, monto: payout.monto },
  });

  redirect(`${RUTA}?ok=${encodeURIComponent(`${payout.codigo} anulada.`)}`);
}
