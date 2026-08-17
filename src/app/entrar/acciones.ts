"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { abrirSesion, cerrarSesion, verificarClave } from "@/lib/auth";
import { registrarEvento } from "@/lib/events";

const Esquema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido."),
  clave: z.string().min(1, "Escribe tu contraseña."),
});

export type EstadoEntrada = { error?: string };

/// Mensaje único para credenciales malas y para cuenta inexistente: decir
/// "ese correo no existe" le confirma a quien prueba cuáles sí existen.
const CREDENCIALES = "Correo o contraseña incorrectos.";

/// Freno contra fuerza bruta. Sin esto, una contraseña de diez caracteres se
/// prueba a millones por hora y el scrypt del hash no sirve de nada: el ataque
/// no es contra el hash, es contra el formulario.
///
/// El contador vive en la base y no en memoria a propósito: en Vercel cada
/// petición puede caer en una instancia distinta, así que un contador local se
/// reinicia solo y no frena nada.
const VENTANA_MIN = 15;
const INTENTOS_MAX = 5;

/// Se cuenta por correo, no por IP: las IP domésticas en Colombia rotan y
/// además se comparten por NAT, así que bloquear por IP castiga a inocentes y
/// deja pasar a quien tenga varias.
async function intentosFallidos(email: string): Promise<number> {
  return prisma.eventLog.count({
    where: {
      entidad: "Acceso",
      entidadId: email,
      tipo: "ENTRADA_FALLIDA",
      createdAt: { gte: new Date(Date.now() - VENTANA_MIN * 60_000) },
    },
  });
}

export async function entrar(
  _previo: EstadoEntrada,
  formData: FormData,
): Promise<EstadoEntrada> {
  const parseado = Esquema.safeParse(Object.fromEntries(formData));
  if (!parseado.success) {
    return { error: parseado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { email, clave } = parseado.data;

  if ((await intentosFallidos(email)) >= INTENTOS_MAX) {
    return {
      error: `Demasiados intentos fallidos. Espera ${VENTANA_MIN} minutos e inténtalo de nuevo.`,
    };
  }

  const operador = await prisma.operator.findUnique({ where: { email } });

  // Se verifica siempre contra un hash, exista o no la cuenta, para que el
  // tiempo de respuesta no revele qué correos están registrados.
  const guardada =
    operador?.clave ??
    "scrypt$16384$8$1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

  const correcta = await verificarClave(clave, guardada);

  if (!operador || !correcta) {
    // Se registra exista o no la cuenta: si solo se anotaran los correos
    // reales, el freno no aplicaría a quien va probando correos al azar.
    await registrarEvento({
      entidad: "Acceso",
      entidadId: email,
      tipo: "ENTRADA_FALLIDA",
      actor: email,
      payload: { cuentaExiste: Boolean(operador) },
    });
    return { error: CREDENCIALES };
  }

  if (!operador.activo) {
    return { error: "Esta cuenta está desactivada. Habla con un administrador." };
  }

  // Entró bien: se borra el historial de fallos para que unos cuantos errores
  // de tipeo de hoy no lo dejen bloqueado cuando vuelva en un rato.
  await prisma.eventLog.deleteMany({
    where: { entidad: "Acceso", entidadId: email, tipo: "ENTRADA_FALLIDA" },
  });

  await prisma.operator.update({
    where: { id: operador.id },
    data: { ultimoAcceso: new Date() },
  });

  await registrarEvento({
    entidad: "Operator",
    entidadId: operador.id,
    tipo: "ENTRADA",
    actor: operador.email,
  });

  await abrirSesion(operador.id);
  redirect("/panel");
}

export async function salir() {
  await cerrarSesion();
  redirect("/entrar");
}
