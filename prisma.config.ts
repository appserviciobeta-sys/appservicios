import path from "node:path";
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Migraciones por el pooler en modo sesión. El pooler transaccional
    // (6543) no soporta las sentencias que Prisma Migrate necesita.
    url: env("DIRECT_URL"),
  },
});
