import Link from "next/link";
import type { ReactNode } from "react";

type Tono = "neutro" | "ok" | "aviso" | "alerta" | "acento";

const TONOS: Record<Tono, string> = {
  neutro: "text-tinta-suave",
  ok: "text-verificado",
  aviso: "text-aviso",
  alerta: "text-alerta",
  acento: "text-sello",
};

/// Píldora de estado. El fondo sale del propio color con color-mix, así que
/// nunca hay una combinación de tinte que no case con su texto.
export function Badge({
  children,
  tono = "neutro",
  girado,
}: {
  children: ReactNode;
  tono?: Tono;
  girado?: boolean;
}) {
  return <span className={`sello ${girado ? "sello-girado" : ""} ${TONOS[tono]}`}>{children}</span>;
}

export function tonoEstado(estado: string): Tono {
  if (
    ["ACTIVO", "VIGENTE", "VERIFICADA", "CERTIFICADA", "ACEPTADA", "ACEPTO", "EJECUTADA", "CALIFICADA", "CERRADA", "RESUELTO", "APROBADO", "LIQUIDADO", "COBRADO"].includes(estado)
  )
    return "ok";
  if (
    ["EN_VERIFICACION", "EN_REVISION", "PENDIENTE", "NUEVA", "SOLICITADO", "ABIERTO", "EN_INVESTIGACION", "DECLARADA", "SUGERIDO", "CONTACTADO", "BORRADOR"].includes(estado)
  )
    return "aviso";
  if (
    ["BLOQUEADO", "SUSPENDIDO", "VENCIDO", "RECHAZADO", "PERDIDA", "NO_SHOW", "CANCELADA_CLIENTE", "CANCELADA_PROFESIONAL", "NO_HABILITADA", "RECHAZO", "ESCALADO", "FALLIDO"].includes(estado)
  )
    return "alerta";
  if (
    ["ASIGNADA", "CONFIRMADA", "EN_CAMINO", "EN_SITIO", "EN_EJECUCION", "COTIZADA", "CLASIFICADA", "AUTORIZADO"].includes(estado)
  )
    return "acento";
  return "neutro";
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ficha ${className}`}>{children}</div>;
}

export function CardTitulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-regla px-4 py-3">
      <h2 className="text-sm font-semibold">{children}</h2>
      {accion}
    </div>
  );
}

export function Metrica({
  etiqueta,
  valor,
  nota,
  tono,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: Tono;
}) {
  const color =
    tono === "alerta"
      ? "text-alerta"
      : tono === "aviso"
        ? "text-aviso"
        : tono === "ok"
          ? "text-verificado"
          : "text-tinta";
  return (
    <Card className="p-4">
      <div className="rotulo">{etiqueta}</div>
      <div className={`cifra mt-2 text-[1.6rem] leading-none font-bold ${color}`}>{valor}</div>
      {nota ? <div className="mt-2 text-xs text-tinta-suave">{nota}</div> : null}
    </Card>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="px-4 py-12 text-center text-sm text-tinta-suave">{children}</div>;
}

/// El botón primario es negro, no de color. En una app donde el acento significa
/// "verificado", gastarlo en cada botón le quita el significado.
export function Boton({
  children,
  tipo = "primario",
  type = "submit",
  name,
  value,
  disabled,
  className = "",
}: {
  children: ReactNode;
  tipo?: "primario" | "secundario" | "peligro";
  type?: "submit" | "button";
  name?: string;
  value?: string;
  disabled?: boolean;
  className?: string;
}) {
  const estilos = {
    primario: "bg-tinta text-papel hover:opacity-88 active:scale-[0.985]",
    secundario:
      "border border-regla-fuerte bg-superficie text-tinta hover:border-tinta active:scale-[0.985]",
    peligro: "border border-alerta text-alerta hover:bg-alerta-tenue active:scale-[0.985]",
  }[tipo];
  return (
    <button
      type={type}
      name={name}
      value={value}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-[var(--radio-sm)] px-4 py-2.5 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${estilos} ${className}`}
    >
      {children}
    </button>
  );
}

export function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="enlace font-medium text-sello">
      {children}
    </Link>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{etiqueta}</span>
      {ayuda ? <span className="mt-0.5 block text-xs text-tinta-suave">{ayuda}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const claseInput =
  "w-full rounded-[var(--radio-sm)] border border-regla bg-superficie px-3.5 py-3 text-[0.9375rem] outline-none transition-colors focus:border-sello";

export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th className={`rotulo border-b border-regla px-4 py-2.5 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  className = "",
}: {
  children: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={`border-b border-regla px-4 py-3 ${right ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}

export function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const pct = maximo <= 0 ? 0 : Math.max(0, Math.min(100, (valor / maximo) * 100));
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-papel-hondo">
      <div className="h-full rounded-full bg-sello" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Aviso({ tono = "aviso", children }: { tono?: Tono; children: ReactNode }) {
  const estilos = {
    aviso: "bg-aviso-tenue text-aviso",
    alerta: "bg-alerta-tenue text-alerta",
    ok: "bg-verificado-tenue text-verificado",
    acento: "bg-sello-tenue text-sello",
    neutro: "bg-papel-hondo text-tinta-media",
  }[tono];
  return (
    <div className={`rounded-[var(--radio-sm)] px-4 py-3 text-sm leading-relaxed ${estilos}`}>
      {children}
    </div>
  );
}

export function Mensajes({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div className="space-y-2">
      {error ? <Aviso tono="alerta">{error}</Aviso> : null}
      {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
    </div>
  );
}

/// Encabezado de paso dentro de un formulario largo.
export function Numeral({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="cifra flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tinta text-xs font-bold text-papel">
        {n}
      </span>
      <h2 className="text-base font-bold tracking-tight">{children}</h2>
    </div>
  );
}
