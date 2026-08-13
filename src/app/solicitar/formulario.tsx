"use client";

import { useActionState, useMemo, useState } from "react";
import { crearSolicitud, type EstadoSolicitud } from "./acciones";
import { camposDe, valoresIniciales } from "@/lib/campos";
import { contextoDeFecha, cotizar, type Respuestas, type ServicioPrecio } from "@/lib/price-engine";
import { cop, minutosATexto } from "@/lib/format";
import { IconoCategoria } from "@/components/iconos";
import { Aviso, Badge, Boton, Campo, Numeral, claseInput } from "@/components/ui";

export type ServicioCliente = ServicioPrecio & {
  slug: string;
  descripcion: string;
  garantiaDias: number;
  categoria: string;
  slugCategoria: string;
};

const OPCIONES_TIEMPO = [
  { valor: "AHORA", titulo: "Ahora", nota: "Lo antes posible" },
  { valor: "HOY", titulo: "Hoy", nota: "En el día" },
  { valor: "PROGRAMADO", titulo: "Programado", nota: "Yo elijo la hora" },
  { valor: "RECURRENTE", titulo: "Recurrente", nota: "Se repite" },
];

export function FormularioSolicitud({ servicios }: { servicios: ServicioCliente[] }) {
  const [estado, accion, enviando] = useActionState<EstadoSolicitud, FormData>(crearSolicitud, {});

  const categorias = useMemo(() => {
    const vistas = new Map<string, { slug: string; nombre: string }>();
    for (const s of servicios) {
      if (!vistas.has(s.slugCategoria)) {
        vistas.set(s.slugCategoria, { slug: s.slugCategoria, nombre: s.categoria });
      }
    }
    return [...vistas.values()];
  }, [servicios]);

  const [categoria, setCategoria] = useState(categorias[0]?.slug ?? "");
  const deLaCategoria = servicios.filter((s) => s.slugCategoria === categoria);

  const [slug, setSlug] = useState(deLaCategoria[0]?.slug ?? servicios[0]?.slug ?? "");
  const servicio = servicios.find((s) => s.slug === slug) ?? servicios[0];

  const campos = useMemo(() => (servicio ? camposDe(servicio.priceRules) : []), [servicio]);
  const [respuestas, setRespuestas] = useState<Record<string, string>>(() =>
    valoresIniciales(camposDe(servicios[0]?.priceRules ?? [])),
  );
  const [urgencia, setUrgencia] = useState("PROGRAMADO");
  const [fechaDeseada, setFechaDeseada] = useState("");

  function elegirServicio(nuevo: string) {
    setSlug(nuevo);
    const servicioNuevo = servicios.find((s) => s.slug === nuevo);
    setRespuestas(valoresIniciales(camposDe(servicioNuevo?.priceRules ?? [])));
  }

  function elegirCategoria(nueva: string) {
    setCategoria(nueva);
    const primero = servicios.find((s) => s.slugCategoria === nueva);
    if (primero) elegirServicio(primero.slug);
  }

  // Vista previa con el MISMO motor que corre en el servidor.
  const cotizacion = useMemo(() => {
    if (!servicio) return null;
    const fecha = fechaDeseada ? new Date(fechaDeseada) : null;
    const entrada: Respuestas = { ...respuestas, ...contextoDeFecha(fecha, urgencia) };
    return cotizar(servicio, entrada);
  }, [servicio, respuestas, urgencia, fechaDeseada]);

  if (!servicio) {
    return <Aviso tono="alerta">No hay servicios activos en el catálogo.</Aviso>;
  }

  const pideFecha = urgencia === "PROGRAMADO" || urgencia === "RECURRENTE";
  const paso = (n: number) => String(campos.length > 0 ? n : n - 1);

  const resumen = cotizacion ? (
    <>
      <ul className="space-y-2.5">
        {cotizacion.lineas.map((linea) => (
          <li key={linea.codigo} className="flex justify-between gap-3 text-sm">
            <span className="text-tinta-media">{linea.etiqueta}</span>
            <span className="cifra shrink-0 font-medium">{cop(linea.monto)}</span>
          </li>
        ))}
      </ul>

      <div className="troquel mt-4 flex items-baseline justify-between pt-4">
        <span className="text-sm font-semibold">
          {cotizacion.requiereDiagnostico ? "Visita" : "Total"}
        </span>
        <span className="cifra text-2xl font-bold">{cop(cotizacion.total)}</span>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between text-xs text-tinta-suave">
        <span>Duración estimada</span>
        <span className="cifra">{minutosATexto(cotizacion.duracionEstimadaMin)}</span>
      </div>
    </>
  ) : null;

  return (
    <form action={accion} className="con-barra grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
      <input type="hidden" name="respuestas" value={JSON.stringify(respuestas)} />
      <input type="hidden" name="servicioSlug" value={slug} />
      <input type="hidden" name="urgencia" value={urgencia} />

      <div className="space-y-9">
        {/* ---- Servicio ---- */}
        <section>
          <Numeral n="1">¿Qué necesitas?</Numeral>

          <div className="scroll-lateral -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {categorias.map((c) => {
              const activa = c.slug === categoria;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => elegirCategoria(c.slug)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activa
                      ? "border-tinta bg-tinta text-papel"
                      : "border-regla bg-superficie text-tinta-media hover:border-regla-fuerte"
                  }`}
                >
                  <IconoCategoria slug={c.slug} className="h-4 w-4" />
                  {c.nombre}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {deLaCategoria.map((s) => {
              const elegido = s.slug === slug;
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => elegirServicio(s.slug)}
                  className={`tocable ficha p-4 text-left ${
                    elegido ? "!border-sello ring-1 ring-sello" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="leading-snug font-bold">{s.nombre}</span>
                    {elegido ? (
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-sello">
                        <path
                          d="m4.5 12.5 5 5 10-11"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="cifra font-bold">
                      {s.modeloPrecio === "DIAGNOSTICO" ? `${cop(s.precioBase)} visita` : cop(s.precioBase)}
                    </span>
                    <span className="text-xs text-tinta-suave">
                      · {minutosATexto(s.duracionMinMin)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-4 rounded-[var(--radio-sm)] bg-papel-hondo px-4 py-3 text-sm leading-relaxed text-tinta-media">
            {servicio.descripcion}
          </p>

          <div className="mt-5">
            <Campo
              etiqueta="Cuéntanos qué pasa"
              ayuda="Con tus palabras. Entre más detalle, mejor asignamos."
            >
              <textarea
                name="texto"
                rows={3}
                className={claseInput}
                placeholder="Ej: se fue la luz en la mitad de la casa y el breaker se baja solo"
              />
            </Campo>
          </div>
        </section>

        {/* ---- Detalles de precio ---- */}
        {campos.length > 0 ? (
          <section>
            <Numeral n="2">Detalles que definen el precio</Numeral>
            <p className="mt-2 ml-10 text-sm text-tinta-media">
              Cada respuesta mueve el total. Sin letra chica.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {campos.map((campo) =>
                campo.tipo === "booleano" ? (
                  <label
                    key={campo.nombre}
                    className={`tocable ficha flex cursor-pointer items-start gap-3 p-4 ${
                      respuestas[campo.nombre] === "1" ? "!border-sello ring-1 ring-sello" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={respuestas[campo.nombre] === "1"}
                      onChange={(e) =>
                        setRespuestas((r) => ({
                          ...r,
                          [campo.nombre]: e.target.checked ? "1" : "0",
                        }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold">{campo.etiqueta}</span>
                      {campo.ayuda ? (
                        <span className="mt-0.5 block text-xs text-tinta-suave">{campo.ayuda}</span>
                      ) : null}
                    </span>
                  </label>
                ) : (
                  <Campo key={campo.nombre} etiqueta={campo.etiqueta} ayuda={campo.ayuda}>
                    <input
                      type="number"
                      inputMode="numeric"
                      className={`${claseInput} cifra`}
                      min={campo.min}
                      max={campo.max}
                      value={respuestas[campo.nombre] ?? ""}
                      onChange={(e) =>
                        setRespuestas((r) => ({ ...r, [campo.nombre]: e.target.value }))
                      }
                    />
                  </Campo>
                ),
              )}
            </div>
          </section>
        ) : null}

        {/* ---- Cuándo ---- */}
        <section>
          <Numeral n={paso(3)}>¿Cuándo?</Numeral>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {OPCIONES_TIEMPO.map((opcion) => {
              const activa = urgencia === opcion.valor;
              return (
                <label
                  key={opcion.valor}
                  className={`tocable ficha cursor-pointer p-4 ${
                    activa ? "!border-sello ring-1 ring-sello" : ""
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={activa}
                    onChange={() => setUrgencia(opcion.valor)}
                  />
                  <span className="block text-sm font-bold">{opcion.titulo}</span>
                  <span className="mt-0.5 block text-xs text-tinta-suave">{opcion.nota}</span>
                </label>
              );
            })}
          </div>

          {pideFecha ? (
            <div className="mt-4">
              <Campo
                etiqueta={urgencia === "RECURRENTE" ? "Primera visita" : "Fecha y hora"}
                ayuda="Los domingos tienen recargo y lo verás en el total."
              >
                <input
                  type="datetime-local"
                  name="fechaDeseada"
                  className={`${claseInput} cifra`}
                  value={fechaDeseada}
                  onChange={(e) => setFechaDeseada(e.target.value)}
                />
              </Campo>
            </div>
          ) : (
            <input type="hidden" name="fechaDeseada" value="" />
          )}
        </section>

        {/* ---- Dónde ---- */}
        <section>
          <Numeral n={paso(4)}>¿Dónde y con quién?</Numeral>
          <p className="mt-2 ml-10 text-sm text-tinta-media">
            Si ya tienes cuenta con este celular, la reconocemos.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre completo">
              <input name="nombre" className={claseInput} required />
            </Campo>
            <Campo etiqueta="Celular">
              <input name="celular" className={`${claseInput} cifra`} inputMode="tel" required />
            </Campo>
            <Campo etiqueta="Correo (opcional)">
              <input name="email" type="email" className={claseInput} />
            </Campo>
            <Campo etiqueta="Barrio o zona">
              <input name="zona" className={claseInput} placeholder="Chapinero" required />
            </Campo>
            <div className="sm:col-span-2">
              <Campo etiqueta="Dirección">
                <input
                  name="direccion"
                  className={claseInput}
                  placeholder="Calle 63 # 9-40, apto 302"
                  required
                />
              </Campo>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[var(--radio-sm)] bg-papel-hondo p-4">
            <input type="checkbox" name="aceptaDatos" value="1" className="mt-0.5" required />
            <span className="text-sm leading-relaxed text-tinta-media">
              Autorizo el tratamiento de mis datos para coordinar este servicio y atender garantías.
            </span>
          </label>

          {estado.error ? (
            <div className="mt-5">
              <Aviso tono="alerta">{estado.error}</Aviso>
            </div>
          ) : null}
        </section>
      </div>

      {/* ---- Resumen de escritorio ---- */}
      <aside className="hidden lg:sticky lg:top-24 lg:block">
        <div className="recibo p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="rotulo">Tu pedido</div>
              <div className="mt-1 leading-snug font-bold">{servicio.nombre}</div>
            </div>
            {servicio.garantiaDias > 0 ? (
              <Badge tono="ok">{servicio.garantiaDias} d</Badge>
            ) : null}
          </div>

          <div className="mt-5">{resumen}</div>

          {cotizacion?.requiereDiagnostico ? (
            <p className="mt-4 rounded-[var(--radio-sm)] bg-sello-tenue px-3 py-2.5 text-xs leading-relaxed text-sello">
              Pagas la visita de diagnóstico. El arreglo se cotiza después y solo se hace si lo
              apruebas.
            </p>
          ) : null}

          <Boton className="mt-5 w-full !py-3.5" disabled={enviando}>
            {enviando ? "Enviando…" : "Solicitar servicio"}
          </Boton>

          <p className="mt-3 text-xs leading-relaxed text-tinta-suave">
            No se cobra nada todavía. Confirmamos por WhatsApp el profesional y la hora de llegada.
          </p>
        </div>
      </aside>

      {/* ---- Barra fija en móvil ---- */}
      <div className="barra-precio fixed inset-x-0 bottom-0 z-30 border-t border-regla bg-superficie/95 px-5 py-3.5 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-tinta-suave">
              {cotizacion?.requiereDiagnostico ? "Visita" : "Total"}
              {cotizacion ? ` · ${minutosATexto(cotizacion.duracionEstimadaMin)}` : ""}
            </div>
            <div className="cifra truncate text-xl font-bold">{cop(cotizacion?.total ?? 0)}</div>
          </div>
          <Boton className="shrink-0 !px-6 !py-3.5" disabled={enviando}>
            {enviando ? "Enviando…" : "Solicitar"}
          </Boton>
        </div>
      </div>
    </form>
  );
}
