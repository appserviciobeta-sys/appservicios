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

export async function entrar(
  _previo: EstadoEntrada,
  formData: FormData,
): Promise<EstadoEntrada> {
  const parseado = Esquema.safeParse(Object.fromEntries(formData));
  if (!parseado.success) {
    return { error: parseado.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { email, clave } = parseado.data;
  const operador = await prisma.operator.findUnique({ where: { email } });

  // Se verifica siempre contra un hash, exista o no la cuenta, para que el
  // tiempo de respuesta no revele qué correos están registrados.
  const guardada =
    operador?.clave ??
    "scrypt$16384$8$1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

  const correcta = await verificarClave(clave, guardada);

  if (!operador || !correcta) {
    if (operador) {
      await registrarEvento({
        entidad: "Operator",
        entidadId: operador.id,
        tipo: "ENTRADA_FALLIDA",
        actor: email,
      });
    }
    return { error: CREDENCIALES };
  }

  if (!operador.activo) {
    return { error: "Esta cuenta está desactivada. Habla con un administrador." };
  }

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
