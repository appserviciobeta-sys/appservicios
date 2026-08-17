import Link from "next/link";
import { prisma } from "@/lib/db";
import { cop, fecha } from "@/lib/format";
import { ESTADOS_LIQUIDACION, METODOS_PAGO, etiqueta } from "@/lib/constants";
import { cuentaDeOrden, margenReal, separarLiquidables } from "@/lib/dinero";
import {
  Aviso,
  Badge,
  Boton,
  Card,
  CardTitulo,
  Mensajes,
  Metrica,
  Tabla,
  Td,
  Th,
  Vacio,
  claseInput,
  tonoEstado,
} from "@/components/ui";
import {
  anularLiquidacion,
  crearLiquidacion,
  marcarGirada,
  registrarCobro,
} from "./acciones";

export const dynamic = "force-dynamic";

const PAGOS = { select: { monto: true, estado: true } } as const;

/// La caja del negocio en una pantalla: qué falta cobrar, qué falta girar y
/// cuánto quedó de verdad. Antes esto vivía en la cabeza del operador.
export default async function DineroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const mensajes = await searchParams;

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [porCobrar, delMes, profesionales, liquidaciones] = await Promise.all([
    // Confirmadas por el cliente: son las únicas cobrables (§30).
    prisma.serviceOrder.findMany({
      where: {
        confirmacionCliente: "OK",
        estadoPago: { in: ["AUTORIZADO", "PARCIAL"] },
      },
      include: { client: true, serviceType: true, pagos: PAGOS },
      orderBy: { confirmadoClienteAt: "asc" },
      take: 50,
    }),
    prisma.serviceOrder.findMany({
      where: { createdAt: { gte: inicioMes } },
      select: {
        precioCliente: true,
        pagoProfesional: true,
        costoMateriales: true,
        pagos: PAGOS,
      },
    }),
    prisma.professional.findMany({
      where: {
        ordenes: {
          some: {
            estado: { in: ["EJECUTADA", "CALIFICADA", "CERRADA"] },
            confirmacionCliente: "OK",
            liquidaciones: { none: { payout: { estado: { not: "ANULADO" } } } },
          },
        },
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        celular: true,
        ordenes: {
          where: {
            estado: { in: ["EJECUTADA", "CALIFICADA", "CERRADA"] },
            confirmacionCliente: "OK",
          },
          select: {
            id: true,
            codigo: true,
            pagoProfesional: true,
            precioCliente: true,
            checkOutAt: true,
            pagos: PAGOS,
            liquidaciones: {
              where: { payout: { estado: { not: "ANULADO" } } },
              select: { id: true },
            },
          },
        },
      },
    }),
    prisma.payout.findMany({
      where: { estado: { not: "ANULADO" } },
      include: { professional: { select: { nombre: true } }, items: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const margen = margenReal(delMes);

  const cuentasPorCobrar = porCobrar.map((o) => ({
    orden: o,
    cuenta: cuentaDeOrden(o.precioCliente, o.pagos),
  }));
  const totalPorCobrar = cuentasPorCobrar.reduce((s, c) => s + c.cuenta.saldo, 0);

  const porGirar = profesionales
    .map((p) => ({ profesional: p, ...separarLiquidables(p.ordenes) }))
    .filter((g) => g.listas.length > 0 || g.sinCobrar.length > 0)
    .sort((a, b) => b.totalListas - a.totalListas);

  const totalPorGirar = porGirar.reduce((s, g) => s + g.totalListas, 0);
  const pendientesDeGiro = liquidaciones.filter((l) => l.estado === "PENDIENTE");

  return (
    <>
      <h1 className="titular text-3xl">Dinero</h1>
      <p className="mt-1 text-sm text-tinta-media">
        Lo que entró, lo que falta cobrar y lo que hay que girar.
      </p>

      <div className="mt-5">
        <Mensajes error={mensajes.error} ok={mensajes.ok} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          etiqueta="Cobrado este mes"
          valor={cop(margen.cobrado)}
          nota="Solo pagos confirmados"
        />
        <Metrica
          etiqueta="Margen bruto"
          valor={cop(margen.bruto)}
          nota={`${margen.porcentaje}% de lo cobrado`}
          tono={margen.bruto > 0 ? "ok" : "alerta"}
        />
        <Metrica
          etiqueta="Por cobrar"
          valor={cop(totalPorCobrar)}
          nota={`${cuentasPorCobrar.length} servicios`}
          tono={totalPorCobrar > 0 ? "aviso" : undefined}
        />
        <Metrica
          etiqueta="Por girar"
          valor={cop(totalPorGirar)}
          nota={`${porGirar.length} profesionales`}
          tono={totalPorGirar > 0 ? "aviso" : undefined}
        />
      </div>

      {/* ---- Por cobrar ---- */}
      <Card className="mt-8">
        <CardTitulo>Por cobrar</CardTitulo>
        {cuentasPorCobrar.length === 0 ? (
          <Vacio>No hay servicios pendientes de cobro.</Vacio>
        ) : (
          <div className="divide-y divide-regla">
            {cuentasPorCobrar.map(({ orden, cuenta }) => (
              <div key={orden.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <Link href={`/panel/servicios/${orden.id}`} className="enlace font-medium">
                      {orden.codigo}
                    </Link>
                    <span className="ml-2 text-sm text-tinta-media">
                      {orden.client.nombre} · {orden.serviceType.nombre}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="cifra text-lg font-medium">{cop(cuenta.saldo)}</div>
                    {cuenta.cobrado > 0 ? (
                      <div className="rotulo">
                        abonado {cop(cuenta.cobrado)} de {cop(cuenta.total)}
                      </div>
                    ) : null}
                  </div>
                </div>

                <form
                  action={registrarCobro}
                  className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]"
                >
                  <input type="hidden" name="ordenId" value={orden.id} />
                  <input type="hidden" name="volverA" value="/panel/dinero" />
                  <input
                    name="monto"
                    type="number"
                    min={1}
                    max={cuenta.saldo}
                    defaultValue={cuenta.saldo}
                    className={`${claseInput} cifra !py-2`}
                    aria-label="Monto"
                  />
                  <select name="metodo" className={`${claseInput} !py-2`} aria-label="Método">
                    {Object.entries(METODOS_PAGO).map(([valor, texto]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </select>
                  <input
                    name="referencia"
                    placeholder="Referencia del banco"
                    className={`${claseInput} !py-2`}
                    aria-label="Referencia"
                  />
                  <Boton tipo="secundario">Registrar</Boton>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---- Por girar ---- */}
      <Card className="mt-6">
        <CardTitulo>Por girar a profesionales</CardTitulo>
        {porGirar.length === 0 ? (
          <Vacio>Nada pendiente de girar.</Vacio>
        ) : (
          <div className="divide-y divide-regla">
            {porGirar.map((g) => (
              <div key={g.profesional.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <Link
                      href={`/panel/profesionales/${g.profesional.id}`}
                      className="enlace font-medium"
                    >
                      {g.profesional.nombre}
                    </Link>
                    <span className="ml-2 text-sm text-tinta-media">
                      {g.listas.length} listos
                      {g.sinCobrar.length > 0 ? ` · ${g.sinCobrar.length} sin cobrar` : ""}
                    </span>
                  </div>
                  <div className="cifra text-lg font-medium">{cop(g.totalListas)}</div>
                </div>

                {g.listas.length > 0 ? (
                  <form action={crearLiquidacion} className="mt-3">
                    <input type="hidden" name="professionalId" value={g.profesional.id} />
                    <Boton tipo="secundario">
                      Armar giro por {cop(g.totalListas)}
                    </Boton>
                  </form>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-tinta-suave">
                    Tiene {cop(g.totalSinCobrar)} en servicios que el cliente todavía no ha
                    pagado. Cóbralos primero: girar contra plata que no entró es cómo se queda
                    sin caja un negocio de comisión.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---- Giros pendientes ---- */}
      {pendientesDeGiro.length > 0 ? (
        <Card className="mt-6">
          <CardTitulo>Giros armados, sin transferir</CardTitulo>
          <div className="divide-y divide-regla">
            {pendientesDeGiro.map((l) => (
              <div key={l.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <span className="cifra font-medium">{l.codigo}</span>
                    <span className="ml-2 text-sm text-tinta-media">
                      {l.professional.nombre} · {l.items.length} servicios
                    </span>
                  </div>
                  <div className="cifra text-lg font-medium">{cop(l.monto)}</div>
                </div>

                <form
                  action={marcarGirada}
                  className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
                >
                  <input type="hidden" name="payoutId" value={l.id} />
                  <select name="metodo" className={`${claseInput} !py-2`} aria-label="Método">
                    {Object.entries(METODOS_PAGO).map(([valor, texto]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </select>
                  <input
                    name="referencia"
                    placeholder="Referencia de la transferencia"
                    className={`${claseInput} !py-2`}
                    aria-label="Referencia"
                    required
                  />
                  <Boton>Ya transferí</Boton>
                </form>

                <form action={anularLiquidacion} className="mt-2">
                  <input type="hidden" name="payoutId" value={l.id} />
                  <button type="submit" className="enlace text-xs text-tinta-media">
                    Anular este giro
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ---- Historial ---- */}
      <Card className="mt-6">
        <CardTitulo>Giros recientes</CardTitulo>
        {liquidaciones.length === 0 ? (
          <Vacio>Todavía no se ha girado nada.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Profesional</Th>
                <Th>Estado</Th>
                <Th>Referencia</Th>
                <Th right>Monto</Th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map((l) => (
                <tr key={l.id}>
                  <Td className="cifra">{l.codigo}</Td>
                  <Td>{l.professional.nombre}</Td>
                  <Td>
                    <Badge tono={tonoEstado(l.estado === "PAGADO" ? "COBRADO" : l.estado)}>
                      {etiqueta(ESTADOS_LIQUIDACION, l.estado)}
                    </Badge>
                    {l.pagadoAt ? (
                      <span className="ml-2 text-xs text-tinta-suave">{fecha(l.pagadoAt)}</span>
                    ) : null}
                  </Td>
                  <Td className="text-xs text-tinta-media">{l.referencia || "—"}</Td>
                  <Td right className="cifra">
                    {cop(l.monto)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>

      {margen.cobrado > 0 && margen.porcentaje < 15 ? (
        <div className="mt-6">
          <Aviso tono="aviso">
            El margen bruto de este mes va en {margen.porcentaje}%. Después de operación y
            soporte, ahí no queda negocio. Revisa el reparto del catálogo o los precios.
          </Aviso>
        </div>
      ) : null}
    </>
  );
}
