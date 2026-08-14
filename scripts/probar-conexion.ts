/**
 * Comprueba que DATABASE_URL y DIRECT_URL sirvan de verdad.
 *
 *   npm run probar-db
 *
 * Responde tres preguntas, que son las que uno se hace cuando el sitio da 500:
 * ¿la contraseña es correcta?, ¿el puerto es el que toca?, ¿las tablas existen?
 * Nunca imprime la contraseña: solo dice cuántos caracteres tiene, que basta
 * para notar que quedó vacía o con los corchetes puestos.
 */
import "dotenv/config";
import { Client } from "pg";

type Revision = { nombre: string; url: string | undefined; puertoEsperado: string; para: string };

const REVISIONES: Revision[] = [
  {
    nombre: "DATABASE_URL",
    url: process.env.DATABASE_URL,
    puertoEsperado: "6543",
    para: "la app en vivo (pooler en modo transacción)",
  },
  {
    nombre: "DIRECT_URL",
    url: process.env.DIRECT_URL,
    puertoEsperado: "5432",
    para: "las migraciones (pooler en modo sesión)",
  },
];

function diseccionar(url: string) {
  // postgresql://usuario:clave@host:puerto/base?parametros
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]*)@([^:/]+):(\d+)\/([^?]+)(\?.*)?$/);
  if (!m) return null;
  return {
    usuario: m[1],
    largoClave: m[2].length,
    claveSospechosa: /[[\]]|^$|YOUR-PASSWORD/i.test(m[2]),
    host: m[3],
    puerto: m[4],
    base: m[5],
    parametros: m[6] ?? "",
  };
}

async function revisar(r: Revision) {
  console.log(`\n── ${r.nombre} ──  ${r.para}`);

  if (!r.url) {
    console.log("   ✗ NO ESTÁ DEFINIDA.");
    console.log("     En local va en .env; en Vercel, en Settings → Environment Variables.");
    return false;
  }

  const p = diseccionar(r.url);
  if (!p) {
    console.log("   ✗ El formato no se entiende. Debe verse así:");
    console.log("     postgresql://usuario:clave@host:puerto/postgres");
    return false;
  }

  console.log(`   usuario     ${p.usuario}`);
  console.log(`   host        ${p.host}`);
  console.log(`   puerto      ${p.puerto}${p.puerto === r.puertoEsperado ? "" : `   ⚠ se esperaba ${r.puertoEsperado}`}`);
  console.log(`   base        ${p.base}`);
  console.log(`   contraseña  ${p.largoClave} caracteres`);

  if (p.claveSospechosa) {
    console.log("   ✗ La contraseña quedó vacía o todavía tiene los corchetes [ ].");
    console.log("     Reemplaza [YOUR-PASSWORD] por la contraseña, sin corchetes.");
    return false;
  }
  if (!p.host.includes("pooler")) {
    console.log("   ⚠ El host no dice 'pooler'. La conexión directa es solo IPv6 y Vercel no la alcanza.");
  }
  if (r.nombre === "DATABASE_URL" && !p.parametros.includes("pgbouncer=true")) {
    console.log("   ⚠ Le falta ?pgbouncer=true al final. Prisma va a fallar contra el pooler.");
  }

  const cliente = new Client({ connectionString: r.url, ssl: { rejectUnauthorized: false } });
  try {
    await cliente.connect();
    const { rows } = await cliente.query(
      `select (select count(*) from information_schema.tables where table_schema='public')::int as tablas,
              (select count(*) from "Category")::int as categorias`,
    );
    console.log(`   ✓ CONECTA. ${rows[0].tablas} tablas · ${rows[0].categorias} categorías en el catálogo`);
    return true;
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.log(`   ✗ NO CONECTA: ${mensaje}`);
    if (/password authentication failed|SASL|SCRAM/i.test(mensaje)) {
      console.log("     La contraseña está mal. Resetéala en Supabase → Settings → Database");
      console.log("     → Reset database password, y actualiza las DOS variables.");
    } else if (/does not exist/i.test(mensaje)) {
      console.log("     Faltan las tablas. Corre:  npm run db:deploy");
    } else if (/ENOTFOUND|EAI_AGAIN/i.test(mensaje)) {
      console.log("     El host no existe. Revisa que lo copiaste completo.");
    } else if (/ETIMEDOUT|ECONNREFUSED/i.test(mensaje)) {
      console.log("     No responde. Revisa el puerto y que el proyecto de Supabase esté activo.");
    }
    return false;
  } finally {
    await cliente.end().catch(() => {});
  }
}

async function main() {
  console.log("Revisando la conexión a Supabase…");
  const resultados: boolean[] = [];
  for (const r of REVISIONES) resultados.push(await revisar(r));

  console.log("");
  if (resultados.every(Boolean)) {
    console.log("Todo en orden. Estas mismas dos variables van en Vercel, tal cual.");
  } else {
    console.log("Hay algo mal arriba. Arréglalo antes de desplegar.");
    process.exit(1);
  }
}

main();
