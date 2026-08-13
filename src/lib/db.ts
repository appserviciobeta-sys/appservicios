import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Conexión a Postgres (Supabase).
 *
 * La app usa el pooler en modo transacción (puerto 6543). Eso obliga a dos
 * cosas: pocas conexiones por instancia, porque en serverless cada función
 * abre la suya, y nada de sentencias preparadas con nombre, que pgbouncer no
 * sabe enrutar. Las migraciones van por otro lado (DIRECT_URL, puerto 5432).
 *
 * El cliente se crea de forma perezosa, en la primera consulta y no al
 * importar el módulo. Next carga cada página durante la compilación para leer
 * su configuración; si conectarse pasara en ese momento, un build sin
 * credenciales fallaría aunque ninguna página consulte nada. Así el error, si
 * falta la variable, aparece cuando de verdad se necesita la base.
 */
function crearCliente(): PrismaClient {
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

function instancia(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const cliente = crearCliente();
    // En desarrollo se reutiliza entre recargas para no agotar el pooler.
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = cliente;
    else return (globalForPrisma.prisma = cliente);
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_destino, propiedad) {
    const cliente = instancia() as unknown as Record<string | symbol, unknown>;
    const valor = cliente[propiedad];
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});
