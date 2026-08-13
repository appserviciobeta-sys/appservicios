import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Conexión a Postgres (Supabase).
 *
 * La app usa el pooler en modo transacción (puerto 6543). Eso obliga a dos
 * cosas: pocas conexiones por instancia, porque en serverless cada función
 * abre la suya, y nada de sentencias preparadas con nombre, que pgbouncer no
 * sabe enrutar. Las migraciones van por otro lado (DIRECT_URL, puerto 5432).
 */
function crearCliente() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. En local va en .env; en Vercel, en Settings → Environment Variables.",
    );
  }

  const adapter = new PrismaPg({
    connectionString: url,
    // Supabase exige TLS. El pooler presenta un certificado que no encadena
    // con las CA del sistema, así que se cifra sin validar la cadena.
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
