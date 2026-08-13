/**
 * Verificación de los motores contra los ejemplos del documento maestro.
 *
 * No es una suite de tests: es el chequeo mínimo de que el catálogo sembrado
 * sigue produciendo los precios que el documento promete. Si un cambio de
 * reglas rompe el §22, esto lo detecta antes que un cliente.
 *
 *   npm run verificar
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { contextoDeFecha, cotizar } from "@/lib/price-engine";
import { cop } from "@/lib/format";

type Caso = {
  nombre: string;
  servicio: string;
  respuestas: Record<string, string | number | boolean>;
  esperado: number;
  referencia: string;
};

const CASOS: Caso[] = [
  {
    nombre: "Limpieza 80 m², 2 baños, horno, ventanas, domingo",
    servicio: "limpieza-apartamento",
    respuestas: { area: 80, banos: 2, horno: 1, ventanas: 1, dia: "DOMINGO", urgencia: "PROGRAMADO" },
    esperado: 115000,
    referencia: "§22 Price Engine",
  },
  {
    nombre: "Instalación de ventilador, programado",
    servicio: "instalacion-ventilador",
    respuestas: { urgencia: "PROGRAMADO" },
    esperado: 75000,
    referencia: "§24 Precio upfront",
  },
  {
    nombre: "Limpieza estándar sin extras",
    servicio: "limpieza-apartamento",
    respuestas: { area: 70, banos: 1, urgencia: "PROGRAMADO" },
    esperado: 70000,
    referencia: "§25 tarifa estándar",
  },
  {
    nombre: "Limpieza el mismo día",
    servicio: "limpieza-apartamento",
    respuestas: { area: 70, banos: 1, urgencia: "HOY" },
    esperado: 80000,
    referencia: "§25 urgencia: hoy $80.000",
  },
  {
    nombre: "Visita de diagnóstico de plomería",
    servicio: "plomeria-diagnostico",
    respuestas: { urgencia: "PROGRAMADO" },
    esperado: 40000,
    referencia: "§23 diagnóstico + cotización",
  },
  {
    nombre: "Limpieza 120 m² (área adicional por unidad)",
    servicio: "limpieza-apartamento",
    respuestas: { area: 120, banos: 1, urgencia: "PROGRAMADO" },
    esperado: 98000, // 70.000 + 40 m² × 700
    referencia: "§23 precio calculado",
  },
];

async function main() {
  let fallos = 0;

  for (const caso of CASOS) {
    const servicio = await prisma.serviceType.findUnique({
      where: { slug: caso.servicio },
      include: { priceRules: true },
    });

    if (!servicio) {
      console.log(`✗ ${caso.nombre}\n   servicio "${caso.servicio}" no existe en el catálogo`);
      fallos++;
      continue;
    }

    const cotizacion = cotizar(servicio, caso.respuestas);
    const ok = cotizacion.total === caso.esperado;
    if (!ok) fallos++;

    console.log(`${ok ? "✓" : "✗"} ${caso.nombre}  [${caso.referencia}]`);
    console.log(`   esperado ${cop(caso.esperado)} · obtenido ${cop(cotizacion.total)}`);
    for (const linea of cotizacion.lineas) {
      console.log(`     ${linea.etiqueta.padEnd(38)} ${cop(linea.monto).padStart(14)}`);
    }
    console.log(
      `     ${"→ profesional / comisión".padEnd(38)} ${cop(cotizacion.pagoProfesional)} / ${cop(cotizacion.comision)}`,
    );
    console.log("");
  }

  // El contexto de fecha debe inyectar el día de la semana sin preguntarlo.
  const domingo = new Date("2026-08-16T10:00:00");
  const ctx = contextoDeFecha(domingo, "PROGRAMADO");
  if (ctx.dia !== "DOMINGO") {
    console.log(`✗ contextoDeFecha devolvió "${ctx.dia}" para un domingo`);
    fallos++;
  } else {
    console.log("✓ contextoDeFecha detecta el domingo para el recargo automático");
  }

  // Las habilidades de alto riesgo deben exigir certificación.
  const altoRiesgo = await prisma.skill.findMany({
    where: { riesgo: "ALTO", requiereCertificacion: false },
  });
  if (altoRiesgo.length > 0) {
    console.log(
      `✗ ${altoRiesgo.length} habilidades de riesgo alto sin exigir certificación: ${altoRiesgo
        .map((s) => s.slug)
        .join(", ")}`,
    );
    fallos++;
  } else {
    console.log("✓ toda habilidad de riesgo alto exige certificación");
  }

  console.log("");
  if (fallos > 0) {
    console.log(`${fallos} verificaciones fallaron.`);
    process.exit(1);
  }
  console.log("Todas las verificaciones pasaron.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
