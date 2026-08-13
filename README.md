# Plataforma de Servicios y Talento Verificado — MVP Concierge

Implementación del MVP que recomienda el §57 del documento maestro
(`docs/Proyecto_Plataforma_Servicios_Documento_Maestro.md`): landing pública,
registro de los dos lados del mercado, formulario con precio en vivo y panel
interno para operar el piloto por WhatsApp **sin perder los datos**.

> El piloto se coordina por WhatsApp, pero cada solicitud, match, precio,
> verificación, incidente y calificación queda estructurado desde el servicio #1.
> El activo no son los servicios: es el grafo de confianza que dejan atrás.

## Correr el proyecto

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Verificar que los motores siguen reproduciendo los ejemplos del documento:

```bash
npm run verificar
```

Para sembrar solo el catálogo, sin datos de demostración:

```bash
SEED_DEMO=false npm run db:seed
```

Los registros de demostración quedan marcados en `notasInternas` con
`DEMO — borrar antes del piloto real`.

## Rutas

**Público**

| Ruta | Qué hace |
|---|---|
| `/` | Landing con posicionamiento del §60 y precios del catálogo |
| `/solicitar` | Pide un servicio con precio en vivo renglón por renglón |
| `/clientes/registro` | Registro de cliente, persona o empresa con sedes |
| `/profesionales/registro` | Registro de profesional, habilidad por habilidad |

**Panel interno**

| Ruta | Qué hace |
|---|---|
| `/panel` | Métricas del piloto y alertas del §52 |
| `/panel/solicitudes` | Clasificar, cotizar, correr el match, asignar o cerrar con motivo |
| `/panel/servicios` | Check-in con código, cambios de alcance, materiales, evidencia, calificación |
| `/panel/profesionales` | Verificar habilidades y documentos, activar, ver Trust Score |
| `/panel/clientes` | Reputación del cliente, sedes B2B, historial y valor |
| `/panel/incidentes` | Investigar, atribuir responsable y registrar el costo real |
| `/panel/catalogo` | Precios, reglas y habilidades requeridas por servicio |

## El momento de la puerta

Es el instante de mayor riesgo del producto: un desconocido entrando a una casa.
El §17 pide que el cliente entregue un código y el profesional lo verifique, pero
eso solo prueba que el profesional llegó al sitio correcto — **no le prueba al
cliente que quien tocó la puerta es el que mandamos**. Aquí la verificación va en
los dos sentidos y en este orden:

1. **El profesional se identifica.** En su pantalla ve una palabra de seguridad
   (`SIERRA PUENTE`). El cliente ve la misma en la suya, junto con la foto, el
   nombre y los últimos 4 dígitos del documento. Si no coincide, no abre.
2. **El cliente entrega el código.** El profesional lo digita y recién ahí se
   registra el check-in con hora y ubicación. Un código equivocado no inicia
   nada y queda registrado como `CHECK_IN_RECHAZADO`.

Ninguna de las dos partes instala una app: cada servicio genera dos enlaces sin
contraseña que el operador manda por WhatsApp desde el panel.

| Enlace | Quién | Qué hace |
|---|---|---|
| `/t/<token>` | Profesional | Ficha del trabajo, voy en camino, llegué, palabra de seguridad, código, fotos, adicionales, cierre |
| `/s/<token>` | Cliente | Quién va a entrar, palabra, código, estado en vivo, aprobar adicionales, confirmar, calificar, pedir reemplazo |

El token **es** la credencial: ninguna acción acepta un id de servicio, y los
enlaces se pueden rotar desde el panel si uno se comparte por error.

Reglas que el flujo hace cumplir:

- No se cierra el trabajo sin **foto del después** — protege al profesional tanto
  como al cliente.
- No se cierra con **adicionales sin responder**.
- El **cliente cierra el servicio**, no el profesional: hasta que confirme, el
  pago no pasa a `AUTORIZADO`. Si reporta un problema, se abre el incidente en el
  acto con la evidencia todavía fresca.

## Los tres motores

Están en `src/lib` y todos son **explicables**: nunca devuelven un número solo,
devuelven el número y su desglose.

- **`price-engine.ts`** (§22–§25) — precio upfront calculado renglón por
  renglón. Corre igual en el servidor y en el navegador, así que la vista previa
  y el cobro no se pueden separar. `npm run verificar` comprueba que reproduce
  el ejemplo del §22 exacto: $115.000.
- **`match-engine.ts`** (§21) — puntúa por habilidades verificadas, trust, zona,
  historial en ese servicio, puntualidad, disponibilidad y carga. Guarda también
  a los descartados y por qué: ese es el mapa de dónde falta oferta.
- **`trust-engine.ts`** (§31, §32, §50) — Trust Score del profesional con ocho
  componentes ponderados y penalización por incidentes atribuidos, más la
  reputación del cliente. Cada recálculo deja snapshot.

## Reglas que el código hace cumplir

No son validaciones cosméticas: son los controles que el documento identifica
como la diferencia entre una plataforma de confianza y un directorio.

- No se activa un profesional sin **cédula vigente** y al menos una habilidad
  verificada (§17).
- Una habilidad de **riesgo alto exige certificación de entidad**; no basta con
  que el operador la verifique (§16).
- No se **verifica** una habilidad sin decir **cómo se comprobó** (§12, §13).
- No se inicia un servicio sin el **código que tiene el cliente**; el intento
  fallido queda registrado (§17).
- No se cierra un servicio con **cambios de alcance sin resolver** (§27).
- No se cierra una solicitud perdida **sin motivo** (§61 — el funnel).
- No se cierra un incidente sin **resolución escrita y responsable atribuido**;
  el costo real alimenta la reserva de garantía en vez de un supuesto (§33, §34).
- Solo las habilidades **verificadas o certificadas** cuentan para el matching.

## Datos y decisiones que quedan registradas

`EventLog` guarda la bitácora completa por entidad, `MatchCandidate` guarda a
los que no ganaron, `TrustSnapshot` guarda por qué subió o bajó el score, y
`ServiceRequest.motivoPerdida` guarda por qué se cayó cada solicitud. Con eso, a
los 1.000 servicios se pueden responder las preguntas del §53 con datos y no con
opiniones.

## Lo que falta antes de operar de verdad

Tres cosas bloquean un piloto con datos reales:

1. **El panel no tiene autenticación.** Cualquiera con la URL entra y ve
   direcciones, cédulas y teléfonos. Es lo primero que hay que cerrar (§47,
   tratamiento de datos).
2. **Las fotos se guardan en disco local.** Sirve en un VPS; en un despliegue
   serverless el disco es efímero y la evidencia de un reclamo se perdería. Hay
   que pasarlas a almacenamiento de objetos.
3. **WhatsApp es manual.** Los enlaces se mandan a mano desde el panel. Para el
   piloto concierge está bien y es lo que recomienda el §57, pero no escala más
   allá de unos cientos de servicios.

## Advertencia sobre los números

Los precios del catálogo, el 80/20 del reparto y las duraciones son **supuestos
de trabajo tomados del documento**, no datos de mercado. El propósito del piloto
es reemplazarlos. El panel muestra take rate real, margen por servicio,
recurrencia por cliente y costo real de incidentes justamente para eso.

## Lenguaje visual

La ergonomía de una app de domicilios, ejecutada con contención. Rappi resuelve
el *cómo se usa*; la sobriedad resuelve *de quién me fío*.

**De Rappi se toma la mecánica:** móvil primero, grilla de categorías con iconos,
chips de categoría con desplazamiento lateral, tarjetas de servicio tocables con
precio y duración, y **barra de precio fija abajo** que se actualiza con cada
respuesta.

**La contención está en todo lo demás:**

- **Una sola familia tipográfica** (Manrope). La jerarquía la hace el peso, no el
  contraste entre fuentes.
- **Un solo acento**, verde pino `#10614a`, reservado para lo verificado. El botón
  primario es **negro**: si el acento se gasta en cada botón, deja de significar
  "comprobado".
- **Numerales tabulares** en todo lo auditable — precios, códigos, scores — para
  que las columnas no bailen.
- Radios de 10–20 px, una sola capa de sombra, borde de un píxel. Sin degradados,
  sin texturas, sin adornos.
- Una entrada escalonada al cargar y nada más. El movimiento acompaña, no decora.

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind 4 ·
Prisma 7 con SQLite (portable a Postgres cambiando el `provider`) · Zod.
