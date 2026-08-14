import { config } from "dotenv";

/**
 * Carga las variables de entorno con la misma precedencia que usa Next.
 *
 *   .env         valores base del proyecto
 *   .env.local   los que manda; es lo que escribe `vercel env pull`
 *
 * Los scripts de consola usaban `dotenv/config`, que solo lee `.env`. Eso hacía
 * que una variable descargada de Vercel funcionara en la app y no en los
 * scripts, que es una diferencia silenciosa y muy molesta de perseguir.
 */
config({ path: ".env" });
config({ path: ".env.local", override: true });
