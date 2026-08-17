/**
 * Comprueba que hashear y verificar una contraseña dan la vuelta completa.
 *
 *   npm run probar-claves
 *
 * No toca la base: solo el criptográfico. Existe porque cuando alguien no puede
 * entrar hay que poder descartar esta parte en diez segundos, en vez de andar
 * adivinando entre la contraseña, la sesión y el despliegue.
 */
import { hashearClave, verificarClave } from "@/lib/claves";

/// El hash señuelo que usa el login cuando el correo no existe, para que el
/// tiempo de respuesta no delate qué correos están registrados.
const SENUELO =
  "scrypt$16384$8$1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
  const clave = "ContrasenaDePrueba2026";
  const hash = await hashearClave(clave);

  const casos: [string, boolean, boolean][] = [
    ["la correcta entra", await verificarClave(clave, hash), true],
    ["una errada no entra", await verificarClave("otraCosa123456", hash), false],
    ["con espacio al final no entra", await verificarClave(`${clave} `, hash), false],
    ["en minúsculas no entra", await verificarClave(clave.toLowerCase(), hash), false],
    ["hash con formato roto no entra", await verificarClave(clave, "no-es-un-hash"), false],
  ];

  let fallos = 0;
  for (const [nombre, dio, esperaba] of casos) {
    if (dio === esperaba) {
      console.log(`  ok    ${nombre}`);
    } else {
      fallos++;
      console.log(`  FALLA ${nombre} — dio ${dio}, esperaba ${esperaba}`);
    }
  }

  // El señuelo tiene 32 bytes de hash y el sistema deriva 64. Si eso reventara,
  // intentar entrar con un correo inexistente daría error 500 en vez del
  // mensaje normal, y el síntoma se leería como "la app está caída".
  try {
    const r = await verificarClave("loquesea", SENUELO);
    console.log(`  ok    el señuelo devuelve ${r} sin reventar`);
  } catch (e) {
    fallos++;
    console.log(`  FALLA el señuelo revienta: ${e instanceof Error ? e.message : e}`);
  }

  console.log(fallos === 0 ? "\nEl hasheo está bien.\n" : `\n${fallos} fallas.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main();
