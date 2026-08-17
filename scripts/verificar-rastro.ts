/**
 * Verificación del cálculo de llegada.
 *
 *   npm run verificar-rastro
 *
 * No toca la base ni la red: `rastro.ts` es lógica pura justamente para poder
 * comprobarlo así. Los casos de abajo son los que rompen el cálculo en la
 * calle — GPS mintiendo, señal vieja, el profesional quieto en un semáforo —
 * y cada uno existe porque equivocarse ahí le dice al cliente una hora que no
 * se va a cumplir.
 */
import {
  FRESCURA_MAX_MS,
  PRECISION_MAX_M,
  VELOCIDAD_BASE_KMH,
  calcularLlegada,
  distanciaATexto,
  esperaATexto,
  type Ping,
} from "@/lib/rastro";

const AHORA = new Date("2026-08-17T15:00:00Z");
const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * 60_000);

/// Un punto en Cali y otro a ~2 km al norte, para tener distancias reales.
const CASA = { lat: 3.4516, lng: -76.5320 };
const A_2KM = { lat: 3.4696, lng: -76.5320 };
const A_5KM = { lat: 3.4966, lng: -76.5320 };

const ping = (p: Partial<Ping> & { lat: number; lng: number }): Ping => ({
  precisionM: 20,
  createdAt: hace(0),
  ...p,
});

let fallos = 0;

function revisar(nombre: string, condicion: boolean, detalle: string) {
  if (condicion) {
    console.log(`  ok    ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${detalle}`);
  }
}

console.log("\nCÁLCULO DE LLEGADA\n");

// --- Sin los datos mínimos no se inventa un número -------------------------
{
  const r = calcularLlegada({ lat: null, lng: null }, [ping(A_2KM)], AHORA);
  revisar("sin destino marcado no calcula", r.estado === "SIN_DESTINO", `dio ${r.estado}`);
}
{
  const r = calcularLlegada(CASA, [], AHORA);
  revisar("sin señales dice que no hay señal", r.estado === "SIN_SENAL", `dio ${r.estado}`);
}

// --- Caso normal ------------------------------------------------------------
{
  const r = calcularLlegada(CASA, [ping(A_2KM)], AHORA);
  const ok = r.estado === "EN_CAMINO" && r.distanciaM > 1800 && r.distanciaM < 2200;
  revisar("a ~2 km calcula distancia y minutos", ok, JSON.stringify(r));

  if (r.estado === "EN_CAMINO") {
    // 2 km a 18 km/h son ~6,7 min. Con una sola lectura no hay velocidad
    // medida, así que debe usar la base y no inventarse otra.
    const esperado = Math.round((r.distanciaM / 1000 / VELOCIDAD_BASE_KMH) * 60);
    revisar(
      "con una sola lectura usa la velocidad base",
      Math.abs(r.minutos - esperado) <= 1,
      `dio ${r.minutos}, esperaba ~${esperado}`,
    );
  }
}

// --- Ya está en la puerta ---------------------------------------------------
{
  const r = calcularLlegada(CASA, [ping({ lat: 3.4517, lng: -76.5321 })], AHORA);
  revisar("a menos de 150 m dice que está llegando", r.estado === "LLEGANDO", `dio ${r.estado}`);
}

// --- Señal vieja: no estimar sobre datos muertos -----------------------------
{
  const viejo = FRESCURA_MAX_MS / 60_000 + 2;
  const r = calcularLlegada(CASA, [ping({ ...A_2KM, createdAt: hace(viejo) })], AHORA);
  const ok = r.estado === "SIN_SENAL" && r.ultimaSenalMin === viejo;
  revisar("señal vieja no produce un ETA falso", ok, JSON.stringify(r));
}

// --- GPS impreciso: ruido de antena, no una posición -------------------------
{
  const r = calcularLlegada(
    CASA,
    [ping({ ...A_2KM, precisionM: PRECISION_MAX_M + 1 })],
    AHORA,
  );
  revisar("descarta lecturas imprecisas", r.estado === "SIN_SENAL", `dio ${r.estado}`);
}
{
  // La imprecisa se ignora, pero la buena de hace un minuto sigue sirviendo.
  const r = calcularLlegada(
    CASA,
    [
      ping({ ...A_2KM, precisionM: 3000 }),
      ping({ ...A_2KM, createdAt: hace(1) }),
    ],
    AHORA,
  );
  revisar("usa la última lectura buena", r.estado === "EN_CAMINO", `dio ${r.estado}`);
}

// --- Velocidad medida contra saltos de GPS -----------------------------------
{
  // 3 km en 1 minuto = 180 km/h. Es un salto de antena, no un carro: si se
  // tomara en serio, el ETA se iría a cero y el cliente bajaría a abrir.
  const r = calcularLlegada(
    CASA,
    [ping(A_2KM), ping({ ...A_5KM, createdAt: hace(1) })],
    AHORA,
  );
  const esperado =
    r.estado === "EN_CAMINO"
      ? Math.round((r.distanciaM / 1000 / VELOCIDAD_BASE_KMH) * 60)
      : -1;
  revisar(
    "ignora velocidades imposibles",
    r.estado === "EN_CAMINO" && Math.abs(r.minutos - esperado) <= 1,
    JSON.stringify(r),
  );
}
{
  // Quieto en un semáforo: dos lecturas casi iguales. No debe concluir que
  // nunca va a llegar.
  const r = calcularLlegada(
    CASA,
    [ping(A_2KM), ping({ ...A_2KM, createdAt: hace(2) })],
    AHORA,
  );
  revisar(
    "un trancón no dispara el ETA al infinito",
    r.estado === "EN_CAMINO" && r.minutos < 20,
    JSON.stringify(r),
  );
}

// --- Redacción --------------------------------------------------------------
console.log("\nREDACCIÓN\n");
revisar("2 min se redondea hacia abajo", esperaATexto(2) === "menos de 3 minutos", esperaATexto(2));
revisar("7 min no promete precisión", esperaATexto(7) === "unos 10 minutos", esperaATexto(7));
revisar("90 min no da un número", esperaATexto(90) === "más de una hora", esperaATexto(90));
revisar("metros redondeados", distanciaATexto(1340) === "1,3 km", distanciaATexto(1340));
revisar("bajo 1 km en metros", distanciaATexto(640) === "600 m", distanciaATexto(640));

console.log(
  fallos === 0
    ? "\nTodo bien.\n"
    : `\n${fallos} ${fallos === 1 ? "falla" : "fallas"}. No despliegues así.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
