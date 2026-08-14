/**
 * Crea o restablece un operador del panel.
 *
 *   npm run operador -- correo@dominio.com "Nombre Apellido" ADMIN
 *
 * Si el correo ya existe, le cambia la contraseña y lo reactiva. La contraseña
 * se genera aquí y se muestra UNA vez: no se guarda en claro en ningún lado.
 *
 * Importa de claves.ts y no de auth.ts a propósito: auth.ts usa las APIs de
 * Next y no se puede cargar desde un script de consola.
 */
import "@/lib/entorno";
import { prisma } from "@/lib/db";
import { generarClave, hashearClave } from "@/lib/claves";

async function main() {
  const [email, nombre, rol = "OPERADOR"] = process.argv.slice(2);

  if (!email || !nombre) {
    console.log('Uso: npm run operador -- correo@dominio.com "Nombre Apellido" [ADMIN|OPERADOR]');
    process.exit(1);
  }
  if (!["ADMIN", "OPERADOR"].includes(rol)) {
    console.log(`Rol inválido: ${rol}. Usa ADMIN u OPERADOR.`);
    process.exit(1);
  }

  const correo = email.trim().toLowerCase();
  const clave = generarClave();
  const hash = await hashearClave(clave);

  const existente = await prisma.operator.findUnique({ where: { email: correo } });

  const operador = await prisma.operator.upsert({
    where: { email: correo },
    create: { email: correo, nombre, clave: hash, rol },
    update: {
      nombre,
      clave: hash,
      rol,
      activo: true,
      // Corta cualquier sesión abierta con la contraseña anterior.
      sesionesDesde: new Date(),
    },
  });

  console.log("");
  console.log(existente ? "  Contraseña restablecida" : "  Operador creado");
  console.log("");
  console.log(`  Correo      ${operador.email}`);
  console.log(`  Nombre      ${operador.nombre}`);
  console.log(`  Rol         ${operador.rol}`);
  console.log(`  Contraseña  ${clave}`);
  console.log("");
  console.log("  Esta contraseña no se vuelve a mostrar. Guárdala en un gestor,");
  console.log("  no en un chat ni en un papel pegado al monitor.");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
