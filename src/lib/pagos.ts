import { prisma } from "@/lib/db";
import { estadoPagoDerivado } from "@/lib/dinero";
import { recalcularTrustCliente } from "@/lib/trust-engine";

/**
 * Operaciones de dinero que sí tocan la base.
 *
 * La lógica de cálculo vive en `dinero.ts`, sin conexión, para poder probarla.
 * Aquí queda solo lo que necesita leer o escribir.
 */

/**
 * Vuelve a calcular el estado de pago de una orden y lo guarda.
 *
 * Se llama después de cualquier movimiento: registrar un cobro, reversarlo,
 * girar una liquidación. La columna `estadoPago` pasa a ser un reflejo de los
 * hechos y no algo que alguien escribió — antes se podía marcar "COBRADO" sin
 * que hubiera entrado un peso.
 */
export async function recalcularEstadoPago(ordenId: string): Promise<string> {
  const orden = await prisma.serviceOrder.findUnique({
    where: { id: ordenId },
    select: {
      id: true,
      clientId: true,
      estado: true,
      precioCliente: true,
      confirmadoClienteAt: true,
      confirmacionCliente: true,
      pagos: { select: { monto: true, estado: true } },
      liquidaciones: {
        // Un giro anulado no liquida nada: la orden vuelve a estar disponible.
        where: { payout: { estado: { not: "ANULADO" } } },
        select: { id: true },
      },
    },
  });

  if (!orden) return "";

  const nuevo = estadoPagoDerivado(orden, orden.pagos, orden.liquidaciones.length > 0);

  await prisma.serviceOrder.update({
    where: { id: ordenId },
    data: { estadoPago: nuevo },
  });

  // El Trust del cliente penaliza servicios completados sin pagar. Si acaba de
  // pagar, ese castigo tiene que desaparecer de una vez y no en el próximo
  // recálculo, que podría ser dentro de días.
  await recalcularTrustCliente(orden.clientId);

  return nuevo;
}

/// Consecutivo legible para las liquidaciones. `LQ-2026-0007` se puede dictar
/// por teléfono y buscar en un extracto; un cuid no.
export async function siguienteCodigoLiquidacion(): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `LQ-${anio}-`;

  const ultima = await prisma.payout.findFirst({
    where: { codigo: { startsWith: prefijo } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });

  const consecutivo = ultima ? Number(ultima.codigo.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(consecutivo).padStart(4, "0")}`;
}
