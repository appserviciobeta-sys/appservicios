import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { cop, fechaHora, minutosATexto, whatsapp } from "@/lib/format";
import { urlsDeEvidencia } from "@/lib/almacenamiento";
import { Aviso, Badge, Boton, Campo, Mensajes, claseInput } from "@/components/ui";
import { FormularioGeo } from "@/components/formulario-geo";
import { CompartirUbicacion } from "@/components/compartir-ubicacion";
import {
  marcarEnCamino,
  pedirCambioAlcance,
  registrarLlegada,
  subirEvidencia,
  terminarTrabajo,
  verificarCodigo,
} from "./acciones";

export const dynamic = "force-dynamic";

/// Vista del profesional. Se abre desde un enlace de WhatsApp, en un celular,
/// a veces con una sola mano y en la puerta de una casa. Por eso: una acción
/// principal por pantalla, botones grandes y cero navegación.
export default async function TrabajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { token } = await params;
  const mensajes = await searchParams;

  const orden = await prisma.serviceOrder.findUnique({
    where: { tokenProfesional: token },
    include: {
      client: true,
      professional: true,
      serviceType: { include: { category: true } },
      request: true,
      quote: { include: { lineas: { orderBy: { orden: "asc" } } } },
      cambiosAlcance: { orderBy: { solicitadoAt: "desc" } },
      evidencias: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!orden) notFound();

  const cambiosPendientes = orden.cambiosAlcance.filter((c) => c.estado === "SOLICITADO");
  const fotosAntes = orden.evidencias.filter((e) => e.tipo === "ANTES");
  const fotosDespues = orden.evidencias.filter((e) => e.tipo === "DESPUES");
  // El bucket es privado: cada foto se muestra con una URL firmada y temporal.
  const fotos = await urlsDeEvidencia(orden.evidencias.filter((e) => e.url));
  const cancelado = orden.estado.startsWith("CANCELADA") || orden.estado === "NO_SHOW";
  const cerrado = ["EJECUTADA", "CALIFICADA", "CERRADA"].includes(orden.estado);
  const enSitio = orden.estado === "EN_SITIO";
  const trabajando = orden.estado === "EN_EJECUCION";
  const porSalir = ["ASIGNADA", "CONFIRMADA"].includes(orden.estado);
  const enCamino = orden.estado === "EN_CAMINO";

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

      {/* ---- Ficha del trabajo (§26) ---- */}
      <section className="ficha mt-5 p-5">
        <div className="rotulo">{orden.serviceType.category.nombre}</div>
        <h1 className="titular mt-1 text-3xl">{orden.serviceType.nombre}</h1>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-tinta-suave">Dirección</dt>
            <dd className="text-right font-medium">{orden.request.direccion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-tinta-suave">Zona</dt>
            <dd className="text-right">{orden.request.zona}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-tinta-suave">Cliente</dt>
            <dd className="text-right">{orden.client.nombre}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-tinta-suave">Cuándo</dt>
            <dd className="cifra text-right">
              {orden.programadoPara ? fechaHora(orden.programadoPara) : "Lo antes posible"}
            </dd>
          </div>
          <div className="troquel flex justify-between gap-4 pt-3">
            <dt className="text-tinta-suave">Te pagamos</dt>
            <dd className="cifra text-xl font-medium">{cop(orden.pagoProfesional)}</dd>
          </div>
          {orden.quote ? (
            <div className="flex justify-between gap-4">
              <dt className="text-tinta-suave">Tiempo estimado</dt>
              <dd className="cifra text-right">
                {minutosATexto(orden.quote.duracionEstimadaMin)}
              </dd>
            </div>
          ) : null}
        </dl>

        {orden.request.textoCliente ? (
          <p className="mt-5 border-l-2 border-regla-fuerte pl-3 text-sm leading-relaxed text-tinta-media">
            “{orden.request.textoCliente}”
          </p>
        ) : null}

        {orden.quote && orden.quote.lineas.length > 1 ? (
          <div className="mt-5">
            <div className="rotulo">Alcance acordado</div>
            <ul className="mt-2 space-y-1">
              {orden.quote.lineas.map((linea) => (
                <li key={linea.id} className="text-sm text-tinta-media">
                  · {linea.etiqueta}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {cancelado ? (
        <div className="mt-5">
          <Aviso tono="alerta">
            Este servicio fue cancelado. No te presentes en la dirección.
          </Aviso>
        </div>
      ) : null}

      {/* ---- PASO 1: salir ---- */}
      {porSalir ? (
        <section className="mt-5">
          <form action={marcarEnCamino}>
            <input type="hidden" name="token" value={token} />
            <Boton className="w-full !py-4 !text-sm">Voy en camino</Boton>
          </form>
          <p className="mt-3 text-center text-xs text-tinta-suave">
            El cliente recibe aviso de que saliste.
          </p>
        </section>
      ) : null}

      {/* ---- PASO 2: llegar ---- */}
      {enCamino ? (
        <section className="mt-5 space-y-5">
          <CompartirUbicacion token={token} />

          <div>
            <FormularioGeo action={registrarLlegada}>
              <input type="hidden" name="token" value={token} />
              <Boton className="w-full !py-4 !text-sm">Llegué a la dirección</Boton>
            </FormularioGeo>
            <p className="mt-3 text-center text-xs text-tinta-suave">
              Tomamos tu ubicación para dejar constancia de la llegada.
            </p>
          </div>
        </section>
      ) : null}

      {/* ---- PASO 3: la puerta ---- */}
      {enSitio ? (
        <section className="mt-5 space-y-5">
          <div className="ficha border-l-[3px] border-l-sello p-5">
            <div className="rotulo">Paso 1 · identifícate</div>
            <p className="mt-2 text-sm leading-relaxed text-tinta-media">
              Dile al cliente esta palabra. Él la tiene en su pantalla y así sabe que eres tú.
            </p>
            <div className="cifra mt-4 text-center text-3xl tracking-[0.14em] text-sello">
              {orden.palabraSeguridad}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-tinta-suave">
              Muéstrale también tu cédula. Si el cliente no reconoce la palabra, no entres y
              escríbenos.
            </p>
          </div>

          <div className="recibo p-5">
            <div className="rotulo">Paso 2 · pide el código</div>
            <p className="mt-2 text-sm leading-relaxed text-tinta-media">
              El cliente tiene un código de 4 dígitos. Pídeselo y escríbelo aquí para poder empezar.
            </p>

            <FormularioGeo action={verificarCodigo} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <input
                name="codigo"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                required
                placeholder="0000"
                className={`${claseInput} cifra !py-4 text-center !text-3xl tracking-[0.5em]`}
              />
              <Boton className="mt-4 w-full !py-4 !text-sm">Iniciar trabajo</Boton>
            </FormularioGeo>

            <p className="mt-4 text-xs leading-relaxed text-tinta-suave">
              Si el código no coincide, no empieces. Puede ser un error al dictarlo o que no sea la
              casa correcta.
            </p>
          </div>
        </section>
      ) : null}

      {/* ---- PASO 4: trabajando ---- */}
      {trabajando ? (
        <div className="mt-5 space-y-5">
          <Aviso tono="ok">
            Trabajo iniciado {fechaHora(orden.checkInAt)}. El cliente ya lo ve en su pantalla.
          </Aviso>

          {cambiosPendientes.length > 0 ? (
            <Aviso tono="aviso">
              Enviaste un trabajo adicional. Espera a que el cliente responda antes de hacerlo.
            </Aviso>
          ) : null}

          {/* Evidencia */}
          <section className="ficha p-5">
            <div className="rotulo">Fotos del trabajo</div>
            <p className="mt-2 text-sm text-tinta-media">
              {fotosAntes.length} antes · {fotosDespues.length} después
            </p>

            <form action={subirEvidencia} className="mt-4 space-y-3">
              <input type="hidden" name="token" value={token} />
              <Campo etiqueta="Momento">
                <select name="tipo" className={claseInput} defaultValue="ANTES">
                  <option value="ANTES">Antes de empezar</option>
                  <option value="DESPUES">Trabajo terminado</option>
                  <option value="INCIDENTE">Algo que salió mal</option>
                </select>
              </Campo>
              <Campo etiqueta="Foto">
                <input
                  type="file"
                  name="foto"
                  accept="image/*"
                  capture="environment"
                  className={claseInput}
                />
              </Campo>
              <Campo etiqueta="Nota (opcional)">
                <input name="nota" className={claseInput} />
              </Campo>
              <Boton tipo="secundario" className="w-full !py-3">
                Guardar foto
              </Boton>
            </form>

            {fotos.length > 0 ? (
              <ul className="mt-4 grid grid-cols-3 gap-2">
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
            ) : null}
          </section>

          {/* Cambio de alcance (§27) */}
          <section className="ficha p-5">
            <div className="rotulo">¿Encontraste algo que no estaba?</div>
            <p className="mt-2 text-sm leading-relaxed text-tinta-media">
              No lo hagas sin avisar. Descríbelo con foto y precio: el cliente aprueba o rechaza
              desde su celular, y así nadie discute al final.
            </p>

            <form action={pedirCambioAlcance} className="mt-4 space-y-3">
              <input type="hidden" name="token" value={token} />
              <Campo etiqueta="Qué encontraste">
                <textarea name="descripcion" rows={3} className={claseInput} required />
              </Campo>
              <Campo etiqueta="Foto (obligatoria)">
                <input
                  type="file"
                  name="foto"
                  accept="image/*"
                  capture="environment"
                  className={claseInput}
                  required
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Valor adicional">
                  <input
                    name="precioAdicional"
                    type="number"
                    min={0}
                    className={`${claseInput} cifra`}
                  />
                </Campo>
                <Campo etiqueta="Minutos extra">
                  <input
                    name="minutosAdicionales"
                    type="number"
                    min={0}
                    className={`${claseInput} cifra`}
                  />
                </Campo>
              </div>
              <Boton tipo="secundario" className="w-full !py-3">
                Enviar al cliente
              </Boton>
            </form>
          </section>

          {orden.cambiosAlcance.length > 0 ? (
            <section className="ficha p-5">
              <div className="rotulo">Trabajos adicionales</div>
              <ul className="mt-3 space-y-3">
                {orden.cambiosAlcance.map((cambio) => (
                  <li key={cambio.id} className="flex items-start justify-between gap-3">
                    <span className="text-sm">{cambio.descripcion}</span>
                    <span className="shrink-0 text-right">
                      <span className="cifra block text-sm">+{cop(cambio.precioAdicional)}</span>
                      <Badge
                        tono={
                          cambio.estado === "APROBADO"
                            ? "ok"
                            : cambio.estado === "RECHAZADO"
                              ? "alerta"
                              : "aviso"
                        }
                      >
                        {cambio.estado}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Cerrar */}
          <section>
            <FormularioGeo action={terminarTrabajo}>
              <input type="hidden" name="token" value={token} />
              <Boton className="w-full !py-4 !text-sm">Terminé el trabajo</Boton>
            </FormularioGeo>
            <p className="mt-3 text-center text-xs leading-relaxed text-tinta-suave">
              Necesitas al menos una foto del trabajo terminado. Es lo que te protege si después hay
              un reclamo.
            </p>
          </section>
        </div>
      ) : null}

      {/* ---- Cerrado ---- */}
      {cerrado ? (
        <section className="mt-5 space-y-4">
          <Aviso tono="ok">
            Trabajo cerrado {fechaHora(orden.checkOutAt)}. Falta que el cliente confirme.
          </Aviso>
          <div className="ficha p-5">
            <div className="rotulo">Tu pago</div>
            <div className="cifra mt-2 text-3xl">{cop(orden.pagoProfesional)}</div>
            <p className="mt-3 text-sm text-tinta-media">
              Se liquida cuando el cliente confirme que quedó bien.
            </p>
          </div>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-regla pt-5 text-center">
        <a
          href={whatsapp("3000000000", `Necesito ayuda con el servicio ${orden.codigo}`)}
          target="_blank"
          rel="noreferrer"
          className="rotulo enlace text-sello"
        >
          Escribir a soporte
        </a>
      </footer>
    </main>
  );
}
