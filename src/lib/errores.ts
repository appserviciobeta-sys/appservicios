import { redirect } from "next/navigation";

/**
 * Los controles operativos (código de servicio equivocado, activar a alguien sin
 * cédula, cerrar un incidente sin resolución) tienen que explicarle al operador
 * QUÉ pasó. Un `throw` dentro de un server action produce una pantalla de error
 * genérica en producción, así que el mensaje viaja por la URL y la página lo
 * muestra como aviso.
 */
export function fallar(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}

export function conExito(ruta: string, mensaje: string): never {
  redirect(`${ruta}?ok=${encodeURIComponent(mensaje)}`);
}
