const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function cop(valor: number | null | undefined): string {
  return COP.format(valor ?? 0);
}

const FECHA = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const SOLO_FECHA = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

export function fechaHora(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  return FECHA.format(new Date(valor));
}

export function fecha(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  return SOLO_FECHA.format(new Date(valor));
}

export function haceCuanto(valor: Date | string | null | undefined): string {
  if (!valor) return "—";
  const ms = Date.now() - new Date(valor).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} d`;
}

/// Códigos legibles para operar por WhatsApp: "SOL-4F2A" se dicta por teléfono.
export function codigoCorto(prefijo: string): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return `${prefijo}-${out}`;
}

/// §17: el cliente recibe este código y el profesional lo verifica antes de iniciar.
export function codigoServicio(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function normalizarCelular(valor: string): string {
  return valor.replace(/[^\d]/g, "");
}

/// Enlace de WhatsApp para operar el piloto sin salir del panel.
export function whatsapp(celular: string, mensaje: string): string {
  const limpio = normalizarCelular(celular);
  const conIndicativo = limpio.startsWith("57") ? limpio : `57${limpio}`;
  return `https://wa.me/${conIndicativo}?text=${encodeURIComponent(mensaje)}`;
}

export function minutosATexto(min: number): string {
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
