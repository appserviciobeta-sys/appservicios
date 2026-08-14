/**
 * Genera el SQL para dejar la autenticación lista, sin necesitar credenciales
 * de base de datos en esta máquina.
 *
 *   npm run sql-arranque -- correo@dominio.com "Nombre Apellido"
 *
 * Imprime un bloque que se pega tal cual en Supabase → SQL Editor. Sirve cuando
 * la app en producción ya conecta pero el .env local no, que es justo lo que
 * pasa cuando la contraseña se cambió en Vercel y no aquí.
 *
 * La contraseña se genera acá y solo se ve en esta terminal: al SQL va el hash.
 */
import "@/lib/entorno";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { generarClave, hashearClave } from "@/lib/claves";

const MIGRACION = "20260814010000_operadores";

function idAleatorio(): string {
  // Formato cuid-ish: suficiente para una fila creada a mano.
  const azar = createHash("sha256")
    .update(String(process.hrtime.bigint()) + Math.random())
    .digest("hex")
    .slice(0, 20);
  return `c${azar}`;
}

function escapar(v: string): string {
  return v.replace(/'/g, "''");
}

async function main() {
  const [email, nombre, claveElegida] = process.argv.slice(2);
  if (!email || !nombre) {
    console.log('Uso: npm run sql-arranque -- correo@dominio.com "Nombre Apellido" [contraseña]');
    console.log("");
    console.log("Sin el tercer argumento se genera una contraseña al azar,");
    console.log("que es lo recomendable si la vas a guardar en un gestor.");
    process.exit(1);
  }

  if (claveElegida && claveElegida.length < 10) {
    console.log("La contraseña debe tener al menos 10 caracteres.");
    console.log("Este panel muestra direcciones de casas y cédulas: no la dejes corta.");
    process.exit(1);
  }

  const correo = email.trim().toLowerCase();
  const clave = claveElegida ?? generarClave();
  const hash = await hashearClave(clave);

  const rutaMigracion = path.join(process.cwd(), "prisma", "migrations", MIGRACION, "migration.sql");
  const sqlMigracion = readFileSync(rutaMigracion, "utf8");
  // Prisma valida la integridad de cada migración con el SHA-256 del archivo.
  const checksum = createHash("sha256").update(sqlMigracion).digest("hex");

  console.log("");
  console.log("═".repeat(70));
  console.log("  CONTRASEÑA DEL PANEL — se muestra una sola vez");
  console.log("");
  console.log(`  Correo      ${correo}`);
  console.log(`  Contraseña  ${clave}`);
  console.log("");
  console.log("  Guárdala en un gestor. No la pegues en un chat.");
  console.log("═".repeat(70));
  console.log("");
  console.log("  Copia TODO lo que sigue y pégalo en Supabase → SQL Editor → Run");
  console.log("");
  console.log("-- ".repeat(23));
  console.log("");
  console.log(sqlMigracion.trim());
  console.log("");
  console.log("-- Deja constancia de la migración para que Prisma no la repita");
  console.log(`INSERT INTO "_prisma_migrations"`);
  console.log(
    `  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)`,
  );
  console.log(`VALUES (`);
  console.log(`  gen_random_uuid()::text,`);
  console.log(`  '${checksum}',`);
  console.log(`  now(),`);
  console.log(`  '${MIGRACION}',`);
  console.log(`  NULL, NULL, now(), 1`);
  console.log(`) ON CONFLICT DO NOTHING;`);
  console.log("");
  console.log("-- Crea tu usuario administrador");
  console.log(`INSERT INTO "Operator" (id, email, nombre, clave, rol, activo, "sesionesDesde", "createdAt", "updatedAt")`);
  console.log(`VALUES (`);
  console.log(`  '${idAleatorio()}',`);
  console.log(`  '${escapar(correo)}',`);
  console.log(`  '${escapar(nombre)}',`);
  console.log(`  '${hash}',`);
  console.log(`  'ADMIN', true, now(), now(), now()`);
  console.log(`)`);
  console.log(`ON CONFLICT (email) DO UPDATE SET`);
  console.log(`  clave = EXCLUDED.clave,`);
  console.log(`  rol = 'ADMIN',`);
  console.log(`  activo = true,`);
  console.log(`  "sesionesDesde" = now(),`);
  console.log(`  "updatedAt" = now();`);
  console.log("");
  console.log("-- ".repeat(23));
  console.log("");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
