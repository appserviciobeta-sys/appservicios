import path from "node:path";
import { config as cargarEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Misma precedencia que Next: .env.local manda sobre .env. Es lo que escribe
// `vercel env pull`, así que las migraciones usan las mismas credenciales que
// la app desplegada.
cargarEnv({ path: ".env" });
cargarEnv({ path: ".env.local", override: true });

/**
 * URL que usan los comandos de migración.
 *
 * Se lee de forma tolerante a propósito. `prisma generate` corre en el
 * `postinstall` de cada build y NO necesita base de datos, pero si aquí se usa
 * `env()` de Prisma, la variable ausente lanza y el despliegue entero se cae
 * antes de compilar. Con el respaldo, generar el cliente nunca depende de tener
 * credenciales; los comandos que sí tocan la base fallan solos y con un
 * mensaje claro si la variable falta.
 *
 * Orden: DIRECT_URL (pooler de sesión, el correcto para migrar) →
 * DATABASE_URL → marcador inválido evidente.
 */
const urlMigraciones =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://sin-configurar:sin-configurar@localhost:5432/sin-configurar";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: urlMigraciones,
  },
});
