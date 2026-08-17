/**
 * Verificación de la cuenta de un servicio.
 *
 *   npm run verificar-dinero
 *
 * Sin base ni red: `dinero.ts` es lógica pura. Los casos son los que descuadran
 * una caja en la vida real — abonos, reversos, cobros de más, giros duplicados.
 * Cada uno está aquí porque equivocarse ahí significa pagar dos veces o girar
 * plata que nunca entró.
 */
import {
  cuentaDeOrden,
  esImpago,
  estadoPagoDerivado,
  margenReal,
  sePuedeCobrar,
  separarLiquidables,
  totalCobrado,
} from "@/lib/dinero";

let fallos = 0;

function revisar(nombre: string, condicion: boolean, detalle: string) {
  if (condicion) {
    console.log(`  ok    ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${detalle}`);
  }
}

const confirmado = (monto: number) => ({ monto, estado: "CONFIRMADO" });
const reversado = (monto: number) => ({ monto, estado: "REVERSADO" });

const CONFIRMADA = {
  estado: "EJECUTADA",
  confirmadoClienteAt: new Date("2026-08-16T10:00:00Z"),
  confirmacionCliente: "OK",
};

console.log("\nCUENTA DE UN SERVICIO\n");

{
  const c = cuentaDeOrden(115_000, []);
  revisar("sin pagos el saldo es todo", c.saldo === 115_000 && !c.completo, JSON.stringify(c));
}
{
  const c = cuentaDeOrden(115_000, [confirmado(50_000)]);
  revisar("un abono deja saldo", c.cobrado === 50_000 && c.saldo === 65_000, JSON.stringify(c));
}
{
  const c = cuentaDeOrden(115_000, [confirmado(65_000), confirmado(50_000)]);
  revisar("dos abonos completan", c.completo && c.saldo === 0, JSON.stringify(c));
}
{
  // Reversar cambia el estado del mismo registro, no agrega otro. Un pago
  // reversado deja el servicio como si nunca se hubiera cobrado.
  const c = cuentaDeOrden(115_000, [reversado(115_000)]);
  revisar(
    "un pago reversado deja el saldo completo",
    c.cobrado === 0 && c.saldo === 115_000 && !c.completo,
    JSON.stringify(c),
  );
}
{
  // Rebotó la transferencia y volvió a pagar: solo cuenta la buena.
  const c = cuentaDeOrden(115_000, [reversado(115_000), confirmado(115_000)]);
  revisar(
    "tras reversar y volver a pagar cuenta una vez",
    c.cobrado === 115_000 && c.completo,
    JSON.stringify(c),
  );
}
{
  // Digitaron de más. Hay que verlo, no esconderlo: es plata por devolver.
  const c = cuentaDeOrden(100_000, [confirmado(120_000)]);
  revisar("cobrar de más deja excedente", c.excedente === 20_000 && c.saldo === 0, JSON.stringify(c));
}
{
  revisar("no cuenta pagos reversados", totalCobrado([reversado(50_000)]) === 0, "sumó un reverso");
}

console.log("\nCUÁNDO SE PUEDE COBRAR (§30)\n");

revisar(
  "sin confirmación del cliente no se cobra",
  !sePuedeCobrar({ estado: "EJECUTADA", confirmadoClienteAt: null, confirmacionCliente: "" }),
  "dejó cobrar sin confirmación",
);
revisar(
  "con reclamo no se cobra",
  !sePuedeCobrar({ ...CONFIRMADA, confirmacionCliente: "RECLAMO" }),
  "dejó cobrar con un reclamo abierto",
);
revisar("confirmada OK sí se cobra", sePuedeCobrar(CONFIRMADA), "bloqueó una confirmada");
revisar(
  "cancelada no se cobra",
  !sePuedeCobrar({ ...CONFIRMADA, estado: "CANCELADA_CLIENTE" }),
  "dejó cobrar una cancelada",
);

console.log("\nESTADO DERIVADO\n");

{
  const orden = { ...CONFIRMADA, precioCliente: 115_000 };
  const casos: [string, ReturnType<typeof confirmado>[], boolean, string][] = [
    ["sin cobrar queda por cobrar", [], false, "AUTORIZADO"],
    ["con abono queda abonado", [confirmado(50_000)], false, "PARCIAL"],
    ["completo queda cobrado", [confirmado(115_000)], false, "COBRADO"],
    ["cobrado y girado", [confirmado(115_000)], true, "LIQUIDADO"],
  ];

  for (const [nombre, pagos, liquidado, esperado] of casos) {
    const r = estadoPagoDerivado(orden, pagos, liquidado);
    revisar(nombre, r === esperado, `dio ${r}, esperaba ${esperado}`);
  }

  const sinConfirmar = estadoPagoDerivado(
    { estado: "EJECUTADA", precioCliente: 115_000, confirmadoClienteAt: null, confirmacionCliente: "" },
    [],
    false,
  );
  revisar("sin confirmar queda sin autorizar", sinConfirmar === "PENDIENTE", sinConfirmar);

  const devuelto = estadoPagoDerivado(orden, [reversado(115_000)], false);
  revisar("todo reversado es reembolso", devuelto === "REEMBOLSADO", devuelto);
}

console.log("\nQUÉ SE PUEDE GIRAR\n");

{
  const base = { precioCliente: 100_000, pagoProfesional: 70_000, checkOutAt: new Date() };
  const ordenes = [
    { ...base, id: "1", codigo: "A", pagos: [confirmado(100_000)], liquidaciones: [] },
    // Cobrada pero ya girada: no puede entrar en otro giro.
    { ...base, id: "2", codigo: "B", pagos: [confirmado(100_000)], liquidaciones: [{ id: "x" }] },
    // Trabajada pero sin cobrar al cliente.
    { ...base, id: "3", codigo: "C", pagos: [], liquidaciones: [] },
    // Abonada a medias: todavía no se cobró completa.
    { ...base, id: "4", codigo: "D", pagos: [confirmado(40_000)], liquidaciones: [] },
  ];

  const r = separarLiquidables(ordenes);

  revisar(
    "solo gira lo cobrado completo",
    r.listas.length === 1 && r.listas[0].id === "1",
    JSON.stringify(r.listas.map((o) => o.id)),
  );
  revisar(
    "no gira dos veces el mismo trabajo",
    !r.listas.some((o) => o.id === "2") && !r.sinCobrar.some((o) => o.id === "2"),
    "una orden ya girada volvió a aparecer",
  );
  revisar(
    "separa lo trabajado sin cobrar",
    r.sinCobrar.length === 2 && r.totalSinCobrar === 140_000,
    JSON.stringify(r),
  );
  revisar("suma bien lo girable", r.totalListas === 70_000, String(r.totalListas));
}

console.log("\nQUÉ CUENTA COMO IMPAGO\n");

{
  const AHORA = new Date("2026-08-17T12:00:00Z").getTime();
  const hace = (dias: number) => new Date(AHORA - dias * 24 * 3600 * 1000);

  // El cambio a estados derivados le cambió el significado a PENDIENTE: ya no
  // es "no ha pagado" sino "el cliente no ha confirmado". Castigar ahí sería
  // culpar al cliente por no pagar algo que el sistema no le deja pagar.
  revisar(
    "sin confirmar no es impago",
    !esImpago({ estadoPago: "PENDIENTE", updatedAt: hace(30) }, AHORA),
    "contó como impago un servicio sin confirmar",
  );
  revisar(
    "confirmado y sin pagar hace 10 días sí es impago",
    esImpago({ estadoPago: "AUTORIZADO", updatedAt: hace(10) }, AHORA),
    "no detectó una deuda real",
  );
  revisar(
    "abonado a medias hace 10 días es impago",
    esImpago({ estadoPago: "PARCIAL", updatedAt: hace(10) }, AHORA),
    "un abono parcial viejo no contó",
  );
  revisar(
    "dentro de los 3 días de gracia no es impago",
    !esImpago({ estadoPago: "AUTORIZADO", updatedAt: hace(1) }, AHORA),
    "castigó dentro del periodo de gracia",
  );
  revisar(
    "cobrado no es impago",
    !esImpago({ estadoPago: "COBRADO", updatedAt: hace(30) }, AHORA),
    "contó como deuda algo ya cobrado",
  );
}

console.log("\nMARGEN REAL\n");

{
  const r = margenReal([
    { precioCliente: 115_000, pagoProfesional: 80_000, costoMateriales: 5_000, pagos: [confirmado(115_000)] },
    // Trabajada y pagada al profesional, pero al cliente no se le ha cobrado:
    // el margen real tiene que reflejar esa pérdida de caja.
    { precioCliente: 100_000, pagoProfesional: 70_000, costoMateriales: 0, pagos: [] },
  ]);

  revisar("solo suma lo que entró", r.cobrado === 115_000, String(r.cobrado));
  revisar(
    "resta todo lo comprometido al profesional",
    r.bruto === 115_000 - 150_000 - 5_000,
    JSON.stringify(r),
  );
  revisar("un margen negativo se ve negativo", r.bruto < 0, String(r.bruto));
}

console.log(
  fallos === 0
    ? "\nTodo bien.\n"
    : `\n${fallos} ${fallos === 1 ? "falla" : "fallas"}. No despliegues así.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
