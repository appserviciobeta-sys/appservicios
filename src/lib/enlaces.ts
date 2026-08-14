/**
 * Dominio público de la plataforma.
 *
 * Se usa para armar los enlaces de la puerta que se mandan por WhatsApp, que
 * tienen que abrir en el celular del profesional y del cliente. Un enlace a
 * localhost no le sirve a nadie.
 *
 * Se deduce solo, en este orden:
 *
 *   1. NEXT_PUBLIC_URL_BASE  — si algún día hay dominio propio, manda este.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — el dominio estable del proyecto. Es el
 *      correcto: no cambia entre despliegues.
 *   3. VERCEL_URL — la URL de ESTE despliegue. Sirve en preview, pero cambia
 *      cada vez, así que solo se usa si no hay nada mejor.
 *   4. localhost, para desarrollo.
 *
 * Así el dominio queda conectado sin configurar nada, y sigue siendo posible
 * apuntarlo a mano el día que haya un dominio de verdad.
 */
export function urlBase(): string {
  const explicito = process.env.NEXT_PUBLIC_URL_BASE?.trim();
  if (explicito) return explicito.replace(/\/+$/, "");

  const produccion = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (produccion) return `https://${produccion.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  const despliegue = process.env.VERCEL_URL?.trim();
  if (despliegue) return `https://${despliegue.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/// Enlace del profesional: la ficha del trabajo y el momento de la puerta.
export function enlaceProfesional(token: string): string {
  return `${urlBase()}/t/${token}`;
}

/// Enlace del cliente: seguimiento, aprobación de adicionales y confirmación.
export function enlaceCliente(token: string): string {
  return `${urlBase()}/s/${token}`;
}
