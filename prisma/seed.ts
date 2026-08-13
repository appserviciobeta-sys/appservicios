/**
 * Seed del catálogo de arranque.
 *
 * Categorías: las 5 que recomienda el §56 del documento maestro (limpieza,
 * plomería, electricidad, jardinería, mantenimiento/pintura). Nada más.
 * El §58 es explícito: no construir 50 categorías antes de demostrar que la
 * gente contrata y repite.
 *
 * Los precios son los del documento y son SUPUESTOS DE TRABAJO, no datos de
 * mercado. Se reemplazan con lo que salga del piloto.
 *
 * Datos demo: se crean solo si SEED_DEMO no es "false". Todo lo demo queda
 * marcado en notasInternas para poder borrarlo antes del piloto real.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { recalcularTrust } from "@/lib/trust-engine";

const MARCA_DEMO = "DEMO — borrar antes del piloto real";

type SkillSeed = { slug: string; nombre: string; riesgo?: string; requiereCertificacion?: boolean };
type ReglaSeed = {
  codigo: string;
  etiqueta: string;
  tipo?: "ADICION" | "POR_UNIDAD" | "MULTIPLICADOR";
  valor: number;
  campo: string;
  valorEsperado?: string;
  umbral?: number;
  minutos?: number;
};
type ServicioSeed = {
  slug: string;
  nombre: string;
  descripcion: string;
  modeloPrecio: "FIJO" | "CALCULADO" | "DIAGNOSTICO";
  precioBase: number;
  duracionMinMin: number;
  duracionMaxMin: number;
  garantiaDias?: number;
  riesgo?: string;
  skills: { slug: string; obligatoria?: boolean }[];
  reglas?: ReglaSeed[];
};
type CategoriaSeed = {
  slug: string;
  nombre: string;
  grupo: string;
  riesgo: string;
  orden: number;
  skills: SkillSeed[];
  servicios: ServicioSeed[];
};

const CATALOGO: CategoriaSeed[] = [
  {
    slug: "limpieza",
    nombre: "Limpieza",
    grupo: "HOGAR",
    riesgo: "BAJO",
    orden: 1,
    skills: [
      { slug: "limpieza-general", nombre: "Limpieza general" },
      { slug: "limpieza-profunda", nombre: "Limpieza profunda" },
      { slug: "limpieza-vidrios", nombre: "Vidrios y ventanas", riesgo: "MEDIO" },
      { slug: "limpieza-post-obra", nombre: "Limpieza post-obra", riesgo: "MEDIO" },
      { slug: "planchado", nombre: "Planchado" },
    ],
    servicios: [
      {
        slug: "limpieza-apartamento",
        nombre: "Limpieza de apartamento",
        descripcion:
          "Limpieza estándar de zonas sociales, habitaciones, baños y cocina. Incluye insumos básicos del profesional.",
        modeloPrecio: "CALCULADO",
        precioBase: 70000,
        duracionMinMin: 180,
        duracionMaxMin: 240,
        garantiaDias: 2,
        skills: [{ slug: "limpieza-general" }],
        // Reproduce exactamente el ejemplo del §22:
        // 80 m² + 2 baños + horno + ventanas + domingo = $115.000
        reglas: [
          { codigo: "m2_adicional", etiqueta: "Área adicional sobre 80 m²", tipo: "POR_UNIDAD", valor: 700, campo: "area", umbral: 80, minutos: 2 },
          { codigo: "banos_extra", etiqueta: "Baños adicionales", tipo: "POR_UNIDAD", valor: 10000, campo: "banos", umbral: 1, minutos: 25 },
          { codigo: "horno", etiqueta: "Limpieza de horno", valor: 15000, campo: "horno", minutos: 30 },
          { codigo: "ventanas", etiqueta: "Ventanas por dentro y por fuera", valor: 10000, campo: "ventanas", minutos: 30 },
          { codigo: "domingo", etiqueta: "Recargo domingo", valor: 10000, campo: "dia", valorEsperado: "DOMINGO" },
          { codigo: "hoy", etiqueta: "Servicio el mismo día", valor: 10000, campo: "urgencia", valorEsperado: "HOY" },
          { codigo: "express", etiqueta: "Express (menos de 60 min)", valor: 30000, campo: "urgencia", valorEsperado: "AHORA" },
        ],
      },
      {
        slug: "limpieza-profunda",
        nombre: "Limpieza profunda",
        descripcion: "Incluye zonas de difícil acceso, electrodomésticos por dentro y detallado.",
        modeloPrecio: "CALCULADO",
        precioBase: 120000,
        duracionMinMin: 300,
        duracionMaxMin: 420,
        garantiaDias: 3,
        skills: [{ slug: "limpieza-profunda" }, { slug: "limpieza-general" }],
        reglas: [
          { codigo: "m2_adicional", etiqueta: "Área adicional sobre 80 m²", tipo: "POR_UNIDAD", valor: 900, campo: "area", umbral: 80, minutos: 3 },
          { codigo: "banos_extra", etiqueta: "Baños adicionales", tipo: "POR_UNIDAD", valor: 15000, campo: "banos", umbral: 1, minutos: 30 },
          { codigo: "domingo", etiqueta: "Recargo domingo", valor: 15000, campo: "dia", valorEsperado: "DOMINGO" },
        ],
      },
      {
        slug: "planchado",
        nombre: "Jornada de planchado",
        descripcion: "Jornada de 4 horas de planchado en el domicilio del cliente.",
        modeloPrecio: "FIJO",
        precioBase: 60000,
        duracionMinMin: 240,
        duracionMaxMin: 240,
        skills: [{ slug: "planchado" }],
        reglas: [
          { codigo: "domingo", etiqueta: "Recargo domingo", valor: 10000, campo: "dia", valorEsperado: "DOMINGO" },
        ],
      },
    ],
  },
  {
    slug: "plomeria",
    nombre: "Plomería",
    grupo: "TECNICO",
    riesgo: "MEDIO",
    orden: 2,
    skills: [
      { slug: "deteccion-fugas", nombre: "Detección de fugas", riesgo: "MEDIO" },
      { slug: "cambio-griferia", nombre: "Cambio de grifería" },
      { slug: "desatoro", nombre: "Desatoro de tuberías" },
      { slug: "instalacion-sanitario", nombre: "Instalación de sanitarios" },
      { slug: "tuberia-pvc", nombre: "Tubería PVC", riesgo: "MEDIO" },
      { slug: "calentadores", nombre: "Calentadores de agua", riesgo: "ALTO", requiereCertificacion: true },
    ],
    servicios: [
      {
        slug: "plomeria-diagnostico",
        nombre: "Visita de diagnóstico de plomería",
        descripcion:
          "Diagnóstico en sitio. El valor se descuenta del trabajo si el cliente aprueba la cotización.",
        modeloPrecio: "DIAGNOSTICO",
        precioBase: 40000,
        duracionMinMin: 45,
        duracionMaxMin: 60,
        riesgo: "MEDIO",
        skills: [{ slug: "deteccion-fugas" }],
      },
      {
        slug: "cambio-griferia",
        nombre: "Cambio de grifería",
        descripcion: "Mano de obra para retirar e instalar grifería. No incluye la grifería.",
        modeloPrecio: "FIJO",
        precioBase: 85000,
        duracionMinMin: 60,
        duracionMaxMin: 90,
        garantiaDias: 30,
        riesgo: "MEDIO",
        skills: [{ slug: "cambio-griferia" }],
        reglas: [
          { codigo: "punto_adicional", etiqueta: "Puntos adicionales", tipo: "POR_UNIDAD", valor: 45000, campo: "puntos", umbral: 1, minutos: 45 },
          { codigo: "express", etiqueta: "Express (menos de 60 min)", valor: 35000, campo: "urgencia", valorEsperado: "AHORA" },
        ],
      },
      {
        slug: "desatoro-sanitario",
        nombre: "Desatoro de sanitario o lavaplatos",
        descripcion: "Desatoro con equipo manual. Si requiere equipo mecánico se cotiza aparte.",
        modeloPrecio: "FIJO",
        precioBase: 95000,
        duracionMinMin: 60,
        duracionMaxMin: 120,
        garantiaDias: 15,
        riesgo: "MEDIO",
        skills: [{ slug: "desatoro" }],
        reglas: [
          { codigo: "hoy", etiqueta: "Servicio el mismo día", valor: 15000, campo: "urgencia", valorEsperado: "HOY" },
          { codigo: "express", etiqueta: "Express (menos de 60 min)", valor: 40000, campo: "urgencia", valorEsperado: "AHORA" },
        ],
      },
    ],
  },
  {
    slug: "electricidad",
    nombre: "Electricidad",
    grupo: "TECNICO",
    riesgo: "ALTO",
    orden: 3,
    skills: [
      { slug: "tomacorrientes", nombre: "Tomacorrientes" },
      { slug: "iluminacion", nombre: "Iluminación" },
      { slug: "breakers", nombre: "Breakers", riesgo: "MEDIO" },
      { slug: "tableros", nombre: "Tableros eléctricos", riesgo: "ALTO", requiereCertificacion: true },
      { slug: "sistemas-solares", nombre: "Sistemas solares", riesgo: "ALTO", requiereCertificacion: true },
      { slug: "diagnostico-electrico", nombre: "Diagnóstico eléctrico", riesgo: "MEDIO" },
    ],
    servicios: [
      {
        slug: "instalacion-ventilador",
        nombre: "Instalación de ventilador de techo",
        descripcion: "Instalación sobre punto eléctrico existente. No incluye el ventilador.",
        modeloPrecio: "FIJO",
        precioBase: 75000,
        duracionMinMin: 45,
        duracionMaxMin: 60,
        garantiaDias: 30,
        riesgo: "MEDIO",
        skills: [{ slug: "iluminacion" }, { slug: "tomacorrientes", obligatoria: false }],
        reglas: [
          { codigo: "punto_nuevo", etiqueta: "Punto eléctrico nuevo", valor: 55000, campo: "punto_nuevo", minutos: 60 },
          { codigo: "hoy", etiqueta: "Servicio el mismo día", valor: 10000, campo: "urgencia", valorEsperado: "HOY" },
          { codigo: "express", etiqueta: "Express (menos de 60 min)", valor: 30000, campo: "urgencia", valorEsperado: "AHORA" },
        ],
      },
      {
        slug: "cambio-tomacorrientes",
        nombre: "Cambio de tomacorrientes o interruptores",
        descripcion: "Cambio de puntos existentes. No incluye materiales.",
        modeloPrecio: "CALCULADO",
        precioBase: 45000,
        duracionMinMin: 30,
        duracionMaxMin: 60,
        garantiaDias: 30,
        riesgo: "MEDIO",
        skills: [{ slug: "tomacorrientes" }],
        reglas: [
          { codigo: "punto_adicional", etiqueta: "Puntos adicionales", tipo: "POR_UNIDAD", valor: 18000, campo: "puntos", umbral: 1, minutos: 20 },
          { codigo: "express", etiqueta: "Express (menos de 60 min)", valor: 30000, campo: "urgencia", valorEsperado: "AHORA" },
        ],
      },
      {
        slug: "diagnostico-electrico",
        nombre: "Visita de diagnóstico eléctrico",
        descripcion:
          "Para fallas sin causa evidente: se va la luz en una zona, breaker que salta, olor a quemado.",
        modeloPrecio: "DIAGNOSTICO",
        precioBase: 45000,
        duracionMinMin: 45,
        duracionMaxMin: 90,
        riesgo: "ALTO",
        skills: [{ slug: "diagnostico-electrico" }, { slug: "breakers" }],
      },
    ],
  },
  {
    slug: "jardineria",
    nombre: "Jardinería",
    grupo: "HOGAR",
    riesgo: "BAJO",
    orden: 4,
    skills: [
      { slug: "corte-cesped", nombre: "Corte de césped" },
      { slug: "poda", nombre: "Poda de arbustos y árboles pequeños", riesgo: "MEDIO" },
      { slug: "fumigacion", nombre: "Fumigación", riesgo: "MEDIO", requiereCertificacion: true },
      { slug: "diseno-jardin", nombre: "Diseño de jardín" },
    ],
    servicios: [
      {
        slug: "mantenimiento-jardin",
        nombre: "Mantenimiento de jardín",
        descripcion: "Corte, bordes, limpieza y retiro de residuos vegetales.",
        modeloPrecio: "CALCULADO",
        precioBase: 60000,
        duracionMinMin: 90,
        duracionMaxMin: 180,
        skills: [{ slug: "corte-cesped" }, { slug: "poda", obligatoria: false }],
        reglas: [
          { codigo: "m2_adicional", etiqueta: "Área adicional sobre 50 m²", tipo: "POR_UNIDAD", valor: 600, campo: "area", umbral: 50, minutos: 2 },
          { codigo: "poda_arboles", etiqueta: "Poda de árboles", valor: 40000, campo: "poda", minutos: 60 },
          { codigo: "retiro_residuos", etiqueta: "Retiro de residuos", valor: 25000, campo: "retiro", minutos: 30 },
        ],
      },
    ],
  },
  {
    slug: "mantenimiento",
    nombre: "Mantenimiento y pintura",
    grupo: "HOGAR",
    riesgo: "MEDIO",
    orden: 5,
    skills: [
      { slug: "pintura-interior", nombre: "Pintura interior" },
      // Trabajo en alturas: en Colombia exige curso vigente, no basta con
      // "sabe pintar". Por eso va como certificación obligatoria.
      { slug: "pintura-exterior", nombre: "Pintura exterior y alturas", riesgo: "ALTO", requiereCertificacion: true },
      { slug: "estuco", nombre: "Estuco y resane" },
      { slug: "drywall", nombre: "Drywall" },
      { slug: "carpinteria-menor", nombre: "Carpintería menor" },
      { slug: "instalacion-soportes", nombre: "Instalación de soportes y repisas" },
    ],
    servicios: [
      {
        slug: "pintura-habitacion",
        nombre: "Pintura de habitación",
        descripcion: "Mano de obra de pintura sobre superficie en buen estado. No incluye pintura.",
        modeloPrecio: "CALCULADO",
        precioBase: 180000,
        duracionMinMin: 300,
        duracionMaxMin: 480,
        garantiaDias: 30,
        riesgo: "MEDIO",
        skills: [{ slug: "pintura-interior" }, { slug: "estuco", obligatoria: false }],
        reglas: [
          { codigo: "habitacion_adicional", etiqueta: "Habitaciones adicionales", tipo: "POR_UNIDAD", valor: 150000, campo: "habitaciones", umbral: 1, minutos: 300 },
          { codigo: "resane", etiqueta: "Resane y estuco", valor: 80000, campo: "resane", minutos: 180 },
          { codigo: "techo", etiqueta: "Incluir techo", valor: 60000, campo: "techo", minutos: 120 },
        ],
      },
      {
        slug: "instalacion-soportes",
        nombre: "Instalación de soportes, repisas o TV",
        descripcion: "Instalación sobre muro. No incluye el soporte.",
        modeloPrecio: "FIJO",
        precioBase: 65000,
        duracionMinMin: 60,
        duracionMaxMin: 90,
        garantiaDias: 15,
        skills: [{ slug: "instalacion-soportes" }],
        reglas: [
          { codigo: "unidad_adicional", etiqueta: "Unidades adicionales", tipo: "POR_UNIDAD", valor: 35000, campo: "unidades", umbral: 1, minutos: 40 },
          { codigo: "hoy", etiqueta: "Servicio el mismo día", valor: 10000, campo: "urgencia", valorEsperado: "HOY" },
        ],
      },
    ],
  },
];

async function sembrarCatalogo() {
  for (const cat of CATALOGO) {
    const categoria = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { slug: cat.slug, nombre: cat.nombre, grupo: cat.grupo, riesgo: cat.riesgo, orden: cat.orden },
      update: { nombre: cat.nombre, grupo: cat.grupo, riesgo: cat.riesgo, orden: cat.orden },
    });

    for (const s of cat.skills) {
      await prisma.skill.upsert({
        where: { slug: s.slug },
        create: {
          slug: s.slug,
          nombre: s.nombre,
          categoryId: categoria.id,
          riesgo: s.riesgo ?? "BAJO",
          requiereCertificacion: s.requiereCertificacion ?? false,
        },
        update: {
          nombre: s.nombre,
          riesgo: s.riesgo ?? "BAJO",
          requiereCertificacion: s.requiereCertificacion ?? false,
        },
      });
    }

    for (const srv of cat.servicios) {
      const servicio = await prisma.serviceType.upsert({
        where: { slug: srv.slug },
        create: {
          slug: srv.slug,
          nombre: srv.nombre,
          descripcion: srv.descripcion,
          categoryId: categoria.id,
          modeloPrecio: srv.modeloPrecio,
          precioBase: srv.precioBase,
          duracionMinMin: srv.duracionMinMin,
          duracionMaxMin: srv.duracionMaxMin,
          garantiaDias: srv.garantiaDias ?? 0,
          riesgo: srv.riesgo ?? cat.riesgo,
        },
        update: {
          nombre: srv.nombre,
          descripcion: srv.descripcion,
          modeloPrecio: srv.modeloPrecio,
          precioBase: srv.precioBase,
          duracionMinMin: srv.duracionMinMin,
          duracionMaxMin: srv.duracionMaxMin,
          garantiaDias: srv.garantiaDias ?? 0,
          riesgo: srv.riesgo ?? cat.riesgo,
        },
      });

      for (const vinculo of srv.skills) {
        const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: vinculo.slug } });
        await prisma.serviceTypeSkill.upsert({
          where: { serviceTypeId_skillId: { serviceTypeId: servicio.id, skillId: skill.id } },
          create: { serviceTypeId: servicio.id, skillId: skill.id, obligatoria: vinculo.obligatoria ?? true },
          update: { obligatoria: vinculo.obligatoria ?? true },
        });
      }

      let orden = 0;
      for (const regla of srv.reglas ?? []) {
        const datos = {
          etiqueta: regla.etiqueta,
          tipo: regla.tipo ?? "ADICION",
          valor: regla.valor,
          campo: regla.campo,
          valorEsperado: regla.valorEsperado ?? "",
          umbral: regla.umbral ?? 0,
          minutos: regla.minutos ?? 0,
          orden: orden++,
        };
        await prisma.priceRule.upsert({
          where: { serviceTypeId_codigo: { serviceTypeId: servicio.id, codigo: regla.codigo } },
          create: { serviceTypeId: servicio.id, codigo: regla.codigo, ...datos },
          update: datos,
        });
      }
    }
  }
}

const PROFESIONALES_DEMO = [
  {
    codigo: "PRO-A1B2",
    nombre: "Carlos Restrepo",
    documento: "10203040",
    celular: "3001112233",
    ciudad: "Bogotá",
    zonas: "Chapinero, Usaquén, Teusaquillo",
    aniosExperiencia: 9,
    skills: [
      { slug: "tomacorrientes", estado: "CERTIFICADA", fuente: "CERTIFICADO_ENTIDAD" },
      { slug: "iluminacion", estado: "VERIFICADA", fuente: "PRUEBA_PRACTICA" },
      { slug: "breakers", estado: "VERIFICADA", fuente: "PRUEBA_CONOCIMIENTO" },
      { slug: "tableros", estado: "EN_VERIFICACION", fuente: "" },
      { slug: "sistemas-solares", estado: "NO_HABILITADA", fuente: "" },
      { slug: "diagnostico-electrico", estado: "VERIFICADA", fuente: "PRUEBA_PRACTICA" },
    ],
    documentos: [
      { tipo: "CEDULA", estado: "VIGENTE" },
      { tipo: "ANTECEDENTES", estado: "VIGENTE", mesesVigencia: 6 },
      { tipo: "CERT_TECNICA", estado: "VIGENTE", mesesVigencia: 24 },
      { tipo: "ARL", estado: "VIGENTE", mesesVigencia: 1 },
    ],
  },
  {
    codigo: "PRO-C3D4",
    nombre: "Marta Ocampo",
    documento: "20304050",
    celular: "3012223344",
    ciudad: "Bogotá",
    zonas: "Chapinero, Suba",
    aniosExperiencia: 6,
    skills: [
      { slug: "limpieza-general", estado: "VERIFICADA", fuente: "REFERENCIA" },
      { slug: "limpieza-profunda", estado: "VERIFICADA", fuente: "EVIDENCIA_FOTO" },
      { slug: "planchado", estado: "VERIFICADA", fuente: "REFERENCIA" },
      { slug: "limpieza-vidrios", estado: "DECLARADA", fuente: "" },
    ],
    documentos: [
      { tipo: "CEDULA", estado: "VIGENTE" },
      { tipo: "ANTECEDENTES", estado: "VIGENTE", mesesVigencia: 6 },
      { tipo: "EPS", estado: "VIGENTE", mesesVigencia: 1 },
    ],
  },
  {
    codigo: "PRO-E5F6",
    nombre: "Julián Peña",
    documento: "30405060",
    celular: "3023334455",
    ciudad: "Bogotá",
    zonas: "Usaquén, Suba",
    aniosExperiencia: 12,
    skills: [
      { slug: "deteccion-fugas", estado: "CERTIFICADA", fuente: "CERTIFICADO_ENTIDAD" },
      { slug: "cambio-griferia", estado: "VERIFICADA", fuente: "PRUEBA_PRACTICA" },
      { slug: "desatoro", estado: "VERIFICADA", fuente: "HISTORIAL_PLATAFORMA" },
      { slug: "instalacion-sanitario", estado: "VERIFICADA", fuente: "PRUEBA_PRACTICA" },
      { slug: "calentadores", estado: "EN_VERIFICACION", fuente: "" },
    ],
    documentos: [
      { tipo: "CEDULA", estado: "VIGENTE" },
      { tipo: "ANTECEDENTES", estado: "VIGENTE", mesesVigencia: 6 },
      { tipo: "CERT_SST", estado: "VIGENTE", mesesVigencia: 12 },
      { tipo: "ARL", estado: "VIGENTE", mesesVigencia: 1 },
    ],
  },
  {
    codigo: "PRO-G7H8",
    nombre: "Sandra Gil",
    documento: "40506070",
    celular: "3034445566",
    ciudad: "Bogotá",
    zonas: "Chapinero, Teusaquillo, Kennedy",
    aniosExperiencia: 3,
    skills: [
      { slug: "limpieza-general", estado: "VERIFICADA", fuente: "PRUEBA_PRACTICA" },
      { slug: "planchado", estado: "DECLARADA", fuente: "" },
    ],
    documentos: [
      { tipo: "CEDULA", estado: "VIGENTE" },
      { tipo: "ANTECEDENTES", estado: "EN_REVISION" },
    ],
  },
  {
    codigo: "PRO-J9K1",
    nombre: "Óscar Villa",
    documento: "50607080",
    celular: "3045556677",
    ciudad: "Bogotá",
    zonas: "Kennedy, Bosa",
    aniosExperiencia: 7,
    skills: [
      { slug: "pintura-interior", estado: "VERIFICADA", fuente: "EVIDENCIA_FOTO" },
      { slug: "estuco", estado: "VERIFICADA", fuente: "EVIDENCIA_FOTO" },
      { slug: "instalacion-soportes", estado: "VERIFICADA", fuente: "PRUEBA_PRACTICA" },
      { slug: "drywall", estado: "DECLARADA", fuente: "" },
    ],
    documentos: [
      { tipo: "CEDULA", estado: "VIGENTE" },
      { tipo: "ANTECEDENTES", estado: "VIGENTE", mesesVigencia: 6 },
      // Documento por vencer: dispara la alerta del §52 en el panel.
      { tipo: "ARL", estado: "VIGENTE", mesesVigencia: 0 },
    ],
  },
];

const MOTIVOS: Record<string, string> = {
  CEDULA: "Saber quién entra a la casa del cliente",
  RUT: "Soporte fiscal del pago al profesional",
  ARL: "Cobertura si el profesional se accidenta trabajando",
  EPS: "Afiliación vigente a salud",
  CERT_SST: "Reducir accidentes en oficios de riesgo",
  CERT_TECNICA: "Competencia certificada por una entidad",
  ANTECEDENTES: "Riesgo de acceso a vivienda y activos",
  REFERENCIA: "Historial verificable de trabajos previos",
};

const CLIENTES_DEMO = [
  {
    codigo: "CLI-M1N2",
    tipo: "PERSONA",
    nombre: "Ana Gómez",
    celular: "3101234567",
    email: "ana@example.com",
    ciudad: "Bogotá",
    zona: "Chapinero",
    direccion: "Calle 63 # 9-40, apto 302",
    origen: "WEB_REGISTRO",
  },
  {
    codigo: "CLI-P3Q4",
    tipo: "PERSONA",
    nombre: "Luis Ramírez",
    celular: "3117654321",
    ciudad: "Bogotá",
    zona: "Usaquén",
    direccion: "Carrera 15 # 120-30",
    origen: "SOLICITUD",
  },
  {
    codigo: "CLI-R5S6",
    tipo: "EMPRESA",
    nombre: "Comercial Andina SAS",
    razonSocial: "Comercial Andina SAS",
    nit: "900123456-7",
    celular: "3129998877",
    email: "servicios@andina.co",
    ciudad: "Bogotá",
    zona: "Teusaquillo",
    direccion: "Av. 39 # 20-15",
    contactoNombre: "Diana Torres",
    contactoCargo: "Jefe administrativa",
    sedes: 4,
    origen: "B2B",
    locales: [
      { nombre: "Sede Teusaquillo", direccion: "Av. 39 # 20-15", zona: "Teusaquillo" },
      { nombre: "Sede Chapinero", direccion: "Calle 60 # 11-20", zona: "Chapinero" },
      { nombre: "Sede Usaquén", direccion: "Carrera 7 # 140-50", zona: "Usaquén" },
      { nombre: "Bodega Kennedy", direccion: "Calle 38 sur # 78-10", zona: "Kennedy" },
    ],
  },
];

async function sembrarDemo() {
  for (const p of PROFESIONALES_DEMO) {
    const pro = await prisma.professional.upsert({
      where: { documento: p.documento },
      create: {
        codigo: p.codigo,
        nombre: p.nombre,
        documento: p.documento,
        celular: p.celular,
        ciudad: p.ciudad,
        zonas: p.zonas,
        aniosExperiencia: p.aniosExperiencia,
        estado: "ACTIVO",
        aceptaDatos: true,
        aceptaDatosEn: new Date(),
        notasInternas: MARCA_DEMO,
      },
      update: { zonas: p.zonas, estado: "ACTIVO", notasInternas: MARCA_DEMO },
    });

    for (const s of p.skills) {
      const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: s.slug } });
      await prisma.professionalSkill.upsert({
        where: { professionalId_skillId: { professionalId: pro.id, skillId: skill.id } },
        create: {
          professionalId: pro.id,
          skillId: skill.id,
          estado: s.estado,
          fuente: s.fuente,
          verificadoPor: s.fuente ? "seed" : null,
          verificadoEn: s.fuente ? new Date() : null,
        },
        update: { estado: s.estado, fuente: s.fuente },
      });
    }

    for (const d of p.documentos) {
      const existente = await prisma.professionalDocument.findFirst({
        where: { professionalId: pro.id, tipo: d.tipo },
      });
      if (existente) continue;
      const venceEn =
        "mesesVigencia" in d && typeof d.mesesVigencia === "number"
          ? new Date(Date.now() + d.mesesVigencia * 30 * 24 * 3600 * 1000)
          : null;
      await prisma.professionalDocument.create({
        data: {
          professionalId: pro.id,
          tipo: d.tipo,
          motivoRiesgo: MOTIVOS[d.tipo] ?? "Reducción de riesgo",
          estado: d.estado,
          venceEn,
          verificadoPor: d.estado === "VIGENTE" ? "seed" : null,
          verificadoEn: d.estado === "VIGENTE" ? new Date() : null,
        },
      });
    }

    // Disponibilidad: lunes a sábado, 7:00 a 17:00.
    const existentes = await prisma.availability.count({ where: { professionalId: pro.id } });
    if (existentes === 0) {
      for (let dia = 1; dia <= 6; dia++) {
        await prisma.availability.create({
          data: { professionalId: pro.id, diaSemana: dia, horaInicio: 7 * 60, horaFin: 17 * 60 },
        });
      }
    }

    // El Trust Score se calcula, nunca se siembra a mano.
    await recalcularTrust(pro.id, "Seed inicial");
  }

  for (const c of CLIENTES_DEMO) {
    const { locales, ...datos } = c;
    const cliente = await prisma.client.upsert({
      where: { celular: c.celular },
      create: {
        ...datos,
        aceptaDatos: true,
        aceptaDatosEn: new Date(),
        notasInternas: MARCA_DEMO,
      },
      update: { notasInternas: MARCA_DEMO },
    });

    for (const local of locales ?? []) {
      const existente = await prisma.clientSite.findFirst({
        where: { clientId: cliente.id, nombre: local.nombre },
      });
      if (existente) continue;
      await prisma.clientSite.create({
        data: { ...local, clientId: cliente.id, ciudad: "Bogotá" },
      });
    }
  }
}

async function main() {
  console.log("Sembrando catálogo…");
  await sembrarCatalogo();

  const [categorias, skills, servicios, reglas] = await Promise.all([
    prisma.category.count(),
    prisma.skill.count(),
    prisma.serviceType.count(),
    prisma.priceRule.count(),
  ]);
  console.log(
    `  ${categorias} categorías · ${skills} habilidades · ${servicios} servicios · ${reglas} reglas de precio`,
  );

  if (process.env.SEED_DEMO !== "false") {
    console.log("Sembrando datos demo (SEED_DEMO=false para omitir)…");
    await sembrarDemo();
    const [pros, clis, sedes] = await Promise.all([
      prisma.professional.count(),
      prisma.client.count(),
      prisma.clientSite.count(),
    ]);
    console.log(`  ${pros} profesionales · ${clis} clientes · ${sedes} sedes B2B`);
    console.log("  Los registros demo están marcados en notasInternas.");
  }

  console.log("Listo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
