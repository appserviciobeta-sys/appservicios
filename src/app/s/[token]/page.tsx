import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { cop, fecha, fechaHora, minutosATexto } from "@/lib/format";
import { documentoParcial } from "@/lib/puerta";
import { urlDeEvidencia, urlsDeEvidencia } from "@/lib/almacenamiento";
import { Aviso, Badge, Boton, Campo, Mensajes, claseInput } from "@/components/ui";
import { RefrescoVivo } from "@/components/refresco-vivo";
import { FormularioGeo } from "@/components/formulario-geo";
import { calcularLlegada, distanciaATexto, esperaATexto } from "@/lib/rastro";
import {
  calificarDesdeCliente,
  confirmarServicio,
  marcarDestino,
  pedirReemplazo,
  responderCambio,
} from "./acciones";

export const dynamic = "force-dynamic";

const PASOS = [
  { clave: "ASIGNADA", texto: "Profesional asignado" },
  { clave: "EN_CAMINO", texto: "En camino" },
  { clave: "EN_SITIO", texto: "En tu puerta" },
  { clave: "EN_EJECUCION", texto: "Trabajando" },
  { clave: "EJECUTADA", texto: "Terminado" },
];

function indicePaso(estado: string): number {
  if (["ASIGNADA", "CONFIRMADA"].includes(estado)) return 0;
  if (estado === "EN_CAMINO") return 1;
  if (estado === "EN_SITIO") return 2;
  if (estado === "EN_EJECUCION") return 3;
  if (["EJECUTADA", "CALIFICADA", "CERRADA"].includes(estado)) return 4;
  return -1;
}

/// Vista del cliente. Responde tres preguntas, en este orden de urgencia:
/// ¿quién va a entrar a mi casa?, ¿en qué va?, ¿cuánto voy a pagar?
export default async function SeguimientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { token } = await params;
  const mensajes = await searchParams;

  const orden = await prisma.serviceOrder.findUnique({
    where: { tokenCliente: token },
    include: {
      client: true,
      professional: { include: { skills: { include: { skill: true } } } },
      serviceType: true,
      request: true,
      quote: { include: { lineas: { orderBy: { orden: "asc" } } } },
      cambiosAlcance: { orderBy: { solicitadoAt: "desc" } },
      evidencias: { where: { url: { not: "" } }, orderBy: { createdAt: "desc" } },
      calificaciones: true,
      // Dos lecturas bastan: la última da la distancia, la anterior da la
      // velocidad real. Traer el recorrido completo no mejoraría el cálculo.
      rastro: { orderBy: { createdAt: "desc" }, take: 2 },
    },
  });

  if (!orden) notFound();

  const paso = indicePaso(orden.estado);
  // Bucket privado: las fotos se muestran con URL firmada y temporal.
  const fotos = await urlsDeEvidencia(orden.evidencias);
  const cambiosPendientes = await Promise.all(
    orden.cambiosAlcance
      .filter((c) => c.estado === "SOLICITADO")
      .map(async (c) => ({ ...c, urlFoto: await urlDeEvidencia(c.fotoUrl) })),
  );
  const yaCalifico = orden.calificaciones.some((c) => c.emisor === "CLIENTE");
  const terminado = Boolean(orden.checkOutAt);
  const porLlegar = paso >= 0 && paso <= 2;
  const verificadas = (orden.professional?.skills ?? []).filter((s) =>
    ["VERIFICADA", "CERTIFICADA"].includes(s.estado),
  );

  const enTrayecto = orden.estado === "EN_CAMINO";
  const llegada = enTrayecto
    ? calcularLlegada({ lat: orden.destinoLat, lng: orden.destinoLng }, orden.rastro)
    : null;
  // Se refresca solo mientras algo puede cambiar en minutos. Con el servicio
  // cerrado, recargar cada treinta segundos gasta datos para nada.
  const enVivo = ["EN_CAMINO", "EN_SITIO", "EN_EJECUCION"].includes(orden.estado);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <span className="titular text-base">
          Servicios <span className="text-sello">verificados</span>
        </span>
        <span className="cifra text-sm text-tinta-suave">{orden.codigo}</span>
      </div>

      <div className="mt-5">
        <Mensajes error={mensajes.error} ok={mensajes.ok} />
      </div>

      {/* ---- Estado ---- */}
      <section className="mt-5">
        <h1 className="titular text-3xl">{orden.serviceType.nombre}</h1>
        <ol className="mt-5 space-y-2.5">
          {PASOS.map((item, i) => {
            const hecho = paso >= i;
            const actual = paso === i;
            return (
              <li key={item.clave} className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    hecho ? "bg-sello" : "bg-regla-fuerte"
                  }`}
                />
                <span
                  className={`text-sm ${
                    actual ? "font-medium text-sello" : hecho ? "" : "text-tinta-suave"
                  }`}
                >
                  {item.texto}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {enVivo ? <RefrescoVivo segundos={30} /> : null}

      {/* ---- Cuánto falta ---- */}
      {llegada ? (
        <section className="mt-6">
          {llegada.estado === "EN_CAMINO" ? (
            <div className="ficha border-l-[3px] border-l-sello p-5">
              <div className="rotulo">Llega en</div>
              <div className="titular mt-1 text-4xl text-sello">
                {esperaATexto(llegada.minutos)}
              </div>
              <div className="cifra mt-2 text-sm text-tinta-media">
                a {distanciaATexto(llegada.distanciaM)} de tu dirección
              </div>
              <p className="mt-4 text-xs leading-relaxed text-tinta-suave">
                Es un estimado según cómo va avanzando. El tráfico puede cambiarlo.
              </p>
            </div>
          ) : null}

          {llegada.estado === "LLEGANDO" ? (
            <div className="ficha border-l-[3px] border-l-sello p-5">
              <div className="rotulo">Ya casi</div>
              <div className="titular mt-1 text-4xl text-sello">Está llegando</div>
              <p className="mt-3 text-sm leading-relaxed text-tinta-media">
                Está a menos de dos cuadras. Ten a la mano la palabra y el código de abajo.
              </p>
            </div>
          ) : null}

          {llegada.estado === "SIN_SENAL" ? (
            <div className="ficha p-5">
              <div className="rotulo">Va en camino</div>
              <p className="mt-2 text-sm leading-relaxed text-tinta-media">
                {llegada.ultimaSenalMin == null
                  ? "Todavía no tenemos señal de su celular, así que no podemos calcular los minutos."
                  : `Sin señal desde hace ${llegada.ultimaSenalMin} minutos. Puede estar en una zona sin cobertura.`}{" "}
                Salió {fechaHora(orden.enCaminoAt)}.
              </p>
            </div>
          ) : null}

          {/* Sin el punto de la casa no hay distancia posible. Se pide aquí,
              que es cuando el dato sirve y el cliente está mirando. */}
          {llegada.estado === "SIN_DESTINO" ? (
            <div className="ficha p-5">
              <div className="rotulo">Va en camino</div>
              <h2 className="titular mt-1 text-2xl">¿Quieres saber cuánto falta?</h2>
              <p className="mt-2 text-sm leading-relaxed text-tinta-media">
                Marca dónde queda tu casa y te mostramos los minutos que faltan. Lo usamos solo
                para calcular la distancia de este servicio.
              </p>
              <FormularioGeo action={marcarDestino} className="mt-4">
                <input type="hidden" name="token" value={token} />
                <Boton className="w-full !py-3">Estoy en mi dirección</Boton>
              </FormularioGeo>
              <p className="mt-3 text-xs leading-relaxed text-tinta-suave">
                Salió {fechaHora(orden.enCaminoAt)}.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---- Quién va a entrar (§17) ---- */}
      {orden.professional && porLlegar ? (
        <section className="ficha mt-6 border-l-[3px] border-l-sello p-5">
          <div className="rotulo">Quién va a tu casa</div>
          <div className="titular mt-1 text-2xl">{orden.professional.nombre}</div>
          <div className="cifra mt-1 text-sm text-tinta-suave">
            C.C. {documentoParcial(orden.professional.documento)} ·{" "}
            {orden.professional.aniosExperiencia} años de experiencia
          </div>

          {verificadas.length > 0 ? (
            <div className="mt-4">
              <div className="rotulo">Habilidades comprobadas</div>
              <ul className="mt-2 space-y-1">
                {verificadas.slice(0, 5).map((registro) => (
                  <li key={registro.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-verificado">✓</span>
                    {registro.skill.nombre}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="troquel mt-5 pt-4">
            <div className="rotulo">Paso 1 · pídele esta palabra</div>
            <div className="cifra mt-2 text-center text-2xl tracking-[0.14em] text-sello">
              {orden.palabraSeguridad}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-tinta-media">
              Antes de abrir, pídele que te diga la palabra. Solo el profesional que asignamos la
              tiene. Si no la sabe o no coincide, <strong>no abras</strong> y escríbenos.
            </p>
          </div>

          <div className="mt-5 border-t border-regla pt-4">
            <div className="rotulo">Paso 2 · entrégale este código</div>
            <div className="cifra mt-2 text-center text-4xl tracking-[0.4em]">
              {orden.codigoServicio}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-tinta-media">
              Solo después de que diga bien la palabra. Él lo escribe en su celular y ahí queda
              registrada la hora de inicio.
            </p>
          </div>
        </section>
      ) : null}

      {/* ---- Cambios de alcance (§27) ---- */}
      {cambiosPendientes.length > 0 ? (
        <section className="mt-6 space-y-4">
          <Aviso tono="aviso">
            El profesional encontró algo que no estaba en el trabajo original. Nada se hace ni se
            cobra hasta que respondas.
          </Aviso>

          {cambiosPendientes.map((cambio) => (
            <div key={cambio.id} className="ficha p-5">
              <p className="text-sm leading-relaxed">{cambio.descripcion}</p>

              {cambio.urlFoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cambio.urlFoto}
                  alt="Lo que encontró el profesional"
                  className="mt-4 w-full rounded-[var(--radio-sm)] border border-regla"
                />
              ) : null}

              <div className="troquel mt-4 flex items-baseline justify-between pt-4">
                <span className="rotulo">Costo adicional</span>
                <span className="cifra text-2xl">+{cop(cambio.precioAdicional)}</span>
              </div>
              {cambio.minutosAdicionales > 0 ? (
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="rotulo">Tiempo adicional</span>
                  <span className="cifra text-sm">
                    +{minutosATexto(cambio.minutosAdicionales)}
                  </span>
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <form action={responderCambio}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="cambioId" value={cambio.id} />
                  <input type="hidden" name="estado" value="APROBADO" />
                  <Boton className="w-full !py-3">Aprobar</Boton>
                </form>
                <form action={responderCambio}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="cambioId" value={cambio.id} />
                  <input type="hidden" name="estado" value="RECHAZADO" />
                  <Boton tipo="secundario" className="w-full !py-3">
                    No hacerlo
                  </Boton>
                </form>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* ---- Confirmación final ---- */}
      {terminado && !orden.confirmadoClienteAt ? (
        <section className="ficha mt-6 p-5">
          <div className="rotulo">El profesional terminó</div>
          <h2 className="titular mt-1 text-2xl">¿Quedó bien?</h2>
          <p className="mt-2 text-sm leading-relaxed text-tinta-media">
            Tu respuesta es la que libera el pago. Si algo quedó mal, dilo ahora que todavía se
            puede resolver fácil.
          </p>

          <form action={confirmarServicio} className="mt-5 space-y-3">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="resultado" value="OK" />
            <Boton className="w-full !py-4">Sí, quedó bien</Boton>
          </form>

          <form action={confirmarServicio} className="mt-5 space-y-3 border-t border-regla pt-5">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="resultado" value="RECLAMO" />
            <Campo etiqueta="Si algo quedó mal, cuéntanos qué pasó">
              <textarea name="detalle" rows={3} className={claseInput} />
            </Campo>
            <Boton tipo="peligro" className="w-full !py-3">
              Reportar un problema
            </Boton>
          </form>
        </section>
      ) : null}

      {orden.confirmadoClienteAt ? (
        <div className="mt-6">
          <Aviso tono={orden.confirmacionCliente === "OK" ? "ok" : "alerta"}>
            {orden.confirmacionCliente === "OK"
              ? `Confirmaste el servicio el ${fecha(orden.confirmadoClienteAt)}.`
              : "Registramos tu reclamo. Te escribimos para resolverlo."}
          </Aviso>
        </div>
      ) : null}

      {/* ---- Calificación ---- */}
      {terminado && orden.confirmadoClienteAt && !yaCalifico ? (
        <section className="ficha mt-6 p-5">
          <div className="rotulo">Califica el servicio</div>
          <form action={calificarDesdeCliente} className="mt-4 space-y-3">
            <input type="hidden" name="token" value={token} />
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: "calidad", etiqueta: "Calidad" },
                { name: "puntualidad", etiqueta: "Puntualidad" },
                { name: "comunicacion", etiqueta: "Trato" },
              ].map((campo) => (
                <Campo key={campo.name} etiqueta={campo.etiqueta}>
                  <select name={campo.name} className={`${claseInput} cifra`} defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Campo>
              ))}
            </div>
            <Campo etiqueta="Comentario (opcional)">
              <textarea name="comentario" rows={2} className={claseInput} />
            </Campo>
            <Boton tipo="secundario" className="w-full !py-3">
              Enviar calificación
            </Boton>
          </form>
        </section>
      ) : null}

      {/* ---- Fotos ---- */}
      {fotos.length > 0 ? (
        <section className="mt-6">
          <div className="rotulo">Fotos del trabajo</div>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {fotos.map((evidencia) => (
              <li key={evidencia.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={evidencia.urlVista}
                  alt={evidencia.nota || evidencia.tipo}
                  className="aspect-square w-full rounded-[var(--radio-sm)] border border-regla object-cover"
                />
                <span className="rotulo">{evidencia.tipo}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Cuenta ---- */}
      <section className="recibo mt-6 p-5">
        <div className="rotulo">Lo que vas a pagar</div>
        {orden.quote ? (
          <ul className="mt-4 space-y-2">
            {orden.quote.lineas.map((linea) => (
              <li key={linea.id} className="flex items-baseline gap-2 text-sm">
                <span className="text-tinta-media">{linea.etiqueta}</span>
                <span className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-regla-fuerte" />
                <span className="cifra shrink-0">{cop(linea.monto)}</span>
              </li>
            ))}
            {orden.cambiosAlcance
              .filter((c) => c.estado === "APROBADO")
              .map((cambio) => (
                <li key={cambio.id} className="flex items-baseline gap-2 text-sm">
                  <span className="text-tinta-media">Trabajo adicional aprobado</span>
                  <span className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-regla-fuerte" />
                  <span className="cifra shrink-0">{cop(cambio.precioAdicional)}</span>
                </li>
              ))}
          </ul>
        ) : null}
        <div className="troquel mt-4 flex items-baseline justify-between pt-4">
          <span className="rotulo">Total</span>
          <span className="cifra text-3xl font-medium">{cop(orden.precioCliente)}</span>
        </div>
        {orden.garantiaHasta ? (
          <div className="mt-4">
            <Badge tono="ok">Garantía hasta {fecha(orden.garantiaHasta)}</Badge>
          </div>
        ) : null}
      </section>

      {/* ---- Reemplazo (§35) ---- */}
      {porLlegar ? (
        <section className="mt-6">
          <details className="ficha p-5">
            <summary className="rotulo cursor-pointer">¿El profesional no llegó?</summary>
            <p className="mt-3 text-sm leading-relaxed text-tinta-media">
              Pide reemplazo y buscamos otro profesional para el mismo trabajo, al mismo precio.
            </p>
            <form action={pedirReemplazo} className="mt-4 space-y-3">
              <input type="hidden" name="token" value={token} />
              <Campo etiqueta="Qué pasó">
                <select name="motivo" className={claseInput}>
                  <option value="NO_APARECIO">No apareció</option>
                  <option value="CANCELO">Me avisó que no venía</option>
                  <option value="CLIENTE_PIDIO">Prefiero otro profesional</option>
                </select>
              </Campo>
              <Boton tipo="peligro" className="w-full !py-3">
                Pedir reemplazo
              </Boton>
            </form>
          </details>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-regla pt-5 text-center text-xs leading-relaxed text-tinta-suave">
        Guarda este enlace: aquí sigues el servicio, apruebas trabajos adicionales y queda tu
        constancia con la garantía.
      </footer>
    </main>
  );
}
