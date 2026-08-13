import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Almacenamiento de evidencia.
 *
 * La evidencia de un servicio es lo que decide un reclamo, así que no puede
 * vivir en el disco de un despliegue serverless: en Vercel ese disco se borra
 * entre invocaciones. Con la clave de servicio de Supabase las fotos van a
 * Storage; sin ella caen a disco local, que sirve para desarrollar y nada más.
 *
 * El bucket es PRIVADO a propósito: son fotos del interior de casas ajenas.
 * Para mostrarlas se firma una URL temporal, no se publican.
 */

const BUCKET = "evidencia";
const MARCA = "sb://";
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 8 * 1024 * 1024;
const VIGENCIA_FIRMA = 60 * 60; // 1 hora

function configuracion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && clave ? { url, clave } : null;
}

export function almacenamientoRemotoActivo(): boolean {
  return configuracion() !== null;
}

export async function guardarEvidencia(
  archivo: File,
  ordenCodigo: string,
): Promise<{ ruta?: string; error?: string }> {
  if (!archivo || archivo.size === 0) return {};
  if (archivo.size > MAX_BYTES) {
    return { error: "La foto pesa más de 8 MB. Tómala de nuevo con menos calidad." };
  }
  if (!TIPOS.includes(archivo.type)) {
    return { error: "Solo se aceptan fotos (JPG, PNG, WEBP)." };
  }

  const extension =
    archivo.type === "image/png" ? "png" : archivo.type === "image/webp" ? "webp" : "jpg";
  const nombre = `${ordenCodigo}/${randomBytes(8).toString("hex")}.${extension}`;
  const datos = Buffer.from(await archivo.arrayBuffer());

  const config = configuracion();
  if (!config) {
    const carpeta = path.join(process.cwd(), "public", "subidas");
    const plano = nombre.replace("/", "-");
    await mkdir(carpeta, { recursive: true });
    await writeFile(path.join(carpeta, plano), datos);
    return { ruta: `/subidas/${plano}` };
  }

  const respuesta = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${nombre}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.clave}`,
      "Content-Type": archivo.type,
      "x-upsert": "true",
    },
    body: new Uint8Array(datos),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    return { error: `No se pudo guardar la foto (${respuesta.status}). ${detalle.slice(0, 120)}` };
  }

  return { ruta: `${MARCA}${nombre}` };
}

/**
 * Convierte lo guardado en una URL que el navegador pueda abrir.
 *
 * En disco es la ruta tal cual. En Supabase se firma una URL con vigencia
 * corta, porque el bucket es privado y no queremos enlaces permanentes a las
 * fotos del interior de la casa de un cliente circulando por WhatsApp.
 */
export async function urlDeEvidencia(ruta: string): Promise<string> {
  if (!ruta) return "";
  if (!ruta.startsWith(MARCA)) return ruta;

  const config = configuracion();
  if (!config) return "";

  const objeto = ruta.slice(MARCA.length);
  const respuesta = await fetch(`${config.url}/storage/v1/object/sign/${BUCKET}/${objeto}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: VIGENCIA_FIRMA }),
    cache: "no-store",
  });

  if (!respuesta.ok) return "";
  const { signedURL, signedUrl } = (await respuesta.json()) as {
    signedURL?: string;
    signedUrl?: string;
  };
  const firmada = signedUrl ?? signedURL;
  return firmada ? `${config.url}/storage/v1${firmada}` : "";
}

/// Resuelve varias rutas de una vez, conservando el orden.
export async function urlsDeEvidencia<T extends { url: string }>(
  items: T[],
): Promise<(T & { urlVista: string })[]> {
  return Promise.all(
    items.map(async (item) => ({ ...item, urlVista: await urlDeEvidencia(item.url) })),
  );
}
