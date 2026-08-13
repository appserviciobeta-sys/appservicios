import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { cop, fechaHora, minutosATexto } from "@/lib/format";
import { URGENCIAS, etiqueta } from "@/lib/constants";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GraciasPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  const solicitud = await prisma.serviceRequest.findUnique({
    where: { codigo },
    include: {
      client: true,
      serviceType: true,
      quotes: { include: { lineas: { orderBy: { orden: "asc" } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!solicitud) notFound();

  const cotizacion = solicitud.quotes[0];
  const esDiagnostico = solicitud.serviceType?.modeloPrecio === "DIAGNOSTICO";

  return (
    <main className="min-h-screen">
      <header className="border-b border-regla-fuerte">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="titular text-lg">
            Servicios <span className="text-sello">verificados</span>
          </Link>
          <span className="rotulo">Constancia de solicitud</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="surgir titular text-[clamp(2.25rem,5.5vw,3.5rem)]">
          Listo, {solicitud.client.nombre.split(" ")[0]}.
        </h1>
        <p
          className="surgir mt-4 max-w-xl text-lg leading-relaxed text-tinta-media"
          style={{ "--retraso": "80ms" } as React.CSSProperties}
        >
          Te escribimos al{" "}
          <span className="cifra text-tinta">{solicitud.client.celular}</span> para confirmar el
          profesional asignado y la hora de llegada.
        </p>

        {/* ---- Recibo ---- */}
        <div
          className="surgir recibo relative mt-10 p-7"
          style={{ "--retraso": "180ms" } as React.CSSProperties}
        >
          <div
            className="estampar absolute -top-4 -right-3 bg-superficie text-verificado"
            style={{ "--retraso": "600ms" } as React.CSSProperties}
          >
            <Badge tono="ok" girado>
              Recibida
            </Badge>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="rotulo">Solicitud</div>
              <div className="cifra mt-1 text-2xl">{solicitud.codigo}</div>
            </div>
            <div className="text-right">
              <div className="rotulo">Cliente</div>
              <div className="cifra mt-1 text-sm">{solicitud.client.codigo}</div>
            </div>
          </div>

          <div className="troquel mt-6 pt-5">
            <div className="titular text-2xl">{solicitud.serviceType?.nombre}</div>
            <div className="mt-2 text-sm text-tinta-media">
              {etiqueta(URGENCIAS, solicitud.urgencia)}
              {solicitud.fechaDeseada ? ` · ${fechaHora(solicitud.fechaDeseada)}` : ""}
            </div>
            <div className="text-sm text-tinta-media">
              {solicitud.direccion} · {solicitud.zona}
            </div>
          </div>

          {cotizacion ? (
            <>
              <ul className="mt-6 space-y-2.5">
                {cotizacion.lineas.map((linea) => (
                  <li key={linea.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-tinta-media">{linea.etiqueta}</span>
                    <span className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-regla-fuerte" />
                    <span className="cifra shrink-0">{cop(linea.monto)}</span>
                  </li>
                ))}
              </ul>

              <div className="troquel mt-5 flex items-baseline justify-between pt-4">
                <span className="rotulo">{esDiagnostico ? "Visita" : "Total"}</span>
                <span className="cifra text-3xl font-medium">{cop(cotizacion.precioTotal)}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="rotulo">Duración estimada</span>
                <span className="cifra text-sm">
                  {minutosATexto(cotizacion.duracionEstimadaMin)}
                </span>
              </div>
            </>
          ) : null}

          {esDiagnostico ? (
            <p className="mt-6 border-l-2 border-sello pl-3 text-xs leading-relaxed text-tinta-media">
              Este valor corresponde a la visita de diagnóstico. El precio del arreglo se cotiza
              después de ver el problema y solo se ejecuta si tú lo apruebas.
            </p>
          ) : null}
        </div>

        {/* ---- Tus tres garantías ---- */}
        <ol className="mt-16 space-y-8">
          {[
            {
              n: "01",
              t: "Código de servicio",
              d: "Antes de que inicie el trabajo recibirás un código. Pídeselo al profesional: sin ese código, no debe empezar.",
            },
            {
              n: "02",
              t: "Nada sin tu aprobación",
              d: "Si aparece trabajo adicional, te llega con foto y precio para que apruebes o rechaces. No hay sobrecostos silenciosos.",
            },
            {
              n: "03",
              t: "Reemplazo",
              d: "Si el profesional no llega, escríbenos y activamos reemplazo.",
            },
          ].map((item) => (
            <li key={item.n} className="flex gap-5">
              <span className="cifra text-sello">{item.n}</span>
              <div>
                <div className="font-medium">{item.t}</div>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-tinta-media">{item.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <Link href="/" className="rotulo enlace mt-14 inline-block text-sello hover:text-tinta">
          ← Volver al inicio
        </Link>
      </div>
    </main>
  );
}
