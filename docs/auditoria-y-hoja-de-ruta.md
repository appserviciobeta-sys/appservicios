# Auditoría, integraciones y hoja de ruta

**Fecha:** agosto de 2026
**Base:** documento maestro de 66 secciones
**Estado del producto:** MVP concierge desplegado, sin operar todavía

---

## 1. Qué está construido

| Sección | Qué pide | Estado |
|---|---|---|
| §5, §56 | 5 categorías de arranque | ✅ limpieza, plomería, electricidad, jardinería, mantenimiento |
| §6 | Modelo de tiempo | ✅ ahora / hoy / programado / recurrente |
| §8 | Cliente, profesional, empresa | ✅ los tres como entidades propias |
| §9–§11 | Registro con habilidades atómicas | ✅ 27 habilidades verificables |
| §16 | Verificado ≠ certificado ≠ declarado | ✅ y solo lo verificado entra al matching |
| §17 | Código de servicio, check-in/out | ✅ **mejorado**: verificación en dos sentidos |
| §21 | Matching | ✅ con desglose y candidatos descartados |
| §22–§25 | Price Engine | ✅ reproduce el ejemplo del §22 exacto |
| §27 | Cambios de alcance | ✅ con foto obligatoria y aprobación del cliente |
| §31, §32 | Reputación de los dos lados | ✅ 8 componentes explicables |
| §33, §34 | Incidentes y garantía | ✅ con responsable atribuido |
| §35 | Reemplazo | ✅ el cliente lo pide sin llamar |
| §37 | Niveles | ✅ score + volumen |
| §39 | B2B con sedes | ✅ modelo listo, falta el tablero |
| §48 | Documentos con motivo de riesgo | ✅ sin motivo no se pide |
| §51 | Risk Engine | ⚠️ básico: riesgo por categoría |
| §52 | Panel interno con alertas | ✅ |
| §53 | Bitácora de eventos | ✅ append-only con actor |

---

## 2. Los cinco huecos que importan

### 2.1 El panel no tiene autenticación — CRÍTICO

Cualquiera con la URL ve direcciones de casas, cédulas, teléfonos y el historial
completo de clientes. No es deuda técnica: es un incumplimiento de la Ley 1581
de 2012 y hace inviable operar con datos reales.

**Bloquea el piloto entero.** Es lo primero.

### 2.2 No hay cobro

El §30 define el flujo (autorizar → servicio → evidencia → liquidar) y el modelo
tiene los estados, pero no hay pasarela. Hoy el dinero se mueve por fuera, lo que
significa que el §36 (permanencia) no tiene con qué sostenerse: si el pago pasa
por fuera, la relación también.

### 2.3 La verificación es manual y por eso no escala

Hoy el operador pide la cédula por WhatsApp, la mira y marca "vigente". Eso es
**creerle a una foto**. La sección 3 de este documento resuelve esto.

### 2.4 El modelo financiero se contradice

El §43 declara take rate **12,5%**. El §44 construye el escenario de 36 meses
sobre **25%** ($3.045M ingresos / $12.160M GMV). Los costos del §44 cuadran
exactamente con esos ingresos, así que el número equivocado es el take rate.

Con 12,5% real, el resultado acumulado pasa de **+$184M a ≈ −$1.050M**.

Además el CAC de $5.000 COP por servicio (~USD 1,25) no es creíble para
adquisición de marketplace, y se modela **por servicio** cuando lo que importa
es CAC por cliente dividido entre servicios recurrentes — recurrencia que el
documento nunca modela.

### 2.5 No hay plan de arranque en frío

66 secciones y ninguna responde: **¿cómo consigo los primeros 30 profesionales
verificados en una zona antes de tener demanda?** El §35 (reemplazo) es la
promesa más cara del documento y depende justo de la densidad que no existe el
mes 1. Prometer reemplazo sin densidad es incumplir el diferenciador.

---

## 3. Integraciones: verificación contra fuentes oficiales

CoreSoft (`coresoft.solutions`) expone APIs REST sobre fuentes colombianas
oficiales. Esto convierte el §16 de "pedir el papel y creer" a "consultar la
fuente en segundos", y es probablemente el cambio de mayor impacto disponible
hoy para el producto.

### 3.1 Qué se conecta y para qué sección

| API | Créditos | Qué resuelve del documento |
|---|---|---|
| **Cédula** | 1 | §9 identidad: que el nombre coincida con el documento |
| **Antecedentes Policía** | 1 | §48 "riesgo de acceso a vivienda y activos" |
| **Antecedentes Procuraduría** | 1 | §48 antecedentes disciplinarios |
| **RNMC** (medidas correctivas) | 1 | §19 comportamiento, señal complementaria |
| **Contraloría** | 1 | §48, requisito para trabajo con entidades |
| **Rama Judicial** | 2 | §48 procesos judiciales abiertos |
| **ADRES / EPS** | 2 | §48 afiliación a salud vigente, **automática** |
| **RUAF** | 2 | §47 afiliación a seguridad social y **ARL** |
| **Certificado de Aportes** | 2 | §47 aportes al día |
| **Verificación Laboral** | 2 | §11 experiencia formal comprobable |
| **RUT / DIAN** | 1 | §48 soporte fiscal del pago al profesional |
| **RUES** | 1 | §39 validar NIT y existencia de la empresa cliente |
| **RUNT + Licencia + SIMIT** | 2 c/u | §5 categoría vehículos, y profesionales que se desplazan en moto |

### 3.2 Lo que cuesta de verdad

Paquete de verificación por profesional:

| Nivel | APIs | Créditos |
|---|---|---|
| **Básico** (riesgo bajo) | Cédula + Policía + Procuraduría + RNMC | 4 |
| **Completo** (riesgo medio/alto) | + Rama Judicial + ADRES + RUAF | 10 |
| **Con vehículo** | + RUNT + Licencia | 14 |

Con el plan **Pro ($119.000/mes, 1.500 créditos)**: ~150 profesionales con
verificación completa al mes, o ~375 con la básica.

**Costo por profesional verificado: entre $320 y $800 COP.**

Compárese con el §45, que presupuesta entre $77M y $180M de capital inicial. La
verificación automática de toda la oferta del primer año cabe en un plan de
$119.000 mensuales. Es la mejor relación costo/riesgo del proyecto.

### 3.3 Lo que esto cambia en el Trust Engine

Hoy `ProfessionalSkill.fuente` acepta: evidencia foto, referencia, prueba de
conocimiento, prueba práctica, certificado de entidad, historial.

Se agrega una fuente **más fuerte que todas**:

```
CONSULTA_FUENTE_OFICIAL
```

Y el componente `identidad` del Trust deja de valer 0,8 por "cédula vigente
según el operador" y pasa a valer 1,0 solo cuando la consulta oficial confirmó
el nombre y no hay antecedentes.

### 3.4 Advertencia legal, no opcional

Consultar antecedentes de una persona **exige su autorización previa, expresa e
informada** (Ley 1581 de 2012, Habeas Data). El formulario de registro ya captura
`aceptaDatos` con fecha, pero el texto debe decir explícitamente **qué fuentes se
van a consultar**. Hoy dice "verificar mi identidad, mis antecedentes y mi
experiencia" — hay que enumerar: Policía, Procuraduría, Rama Judicial, ADRES.

Y una advertencia de diseño: **SISBÉN no se usa.** Un puntaje socioeconómico como
insumo de matching o de precio es discriminación, y además no predice calidad de
trabajo. Está disponible en el catálogo; no lo conectamos.

---

## 4. La capa administrativa y de datos

El §53 dice que los datos son la ventaja competitiva. Para que eso sea cierto,
hay que decidir **qué se captura desde el servicio #1**, no cuando haya volumen.

### 4.1 Lo que ya se captura

- `EventLog` — bitácora append-only con actor y payload
- `MatchCandidate` — **incluidos los descartados y su motivo**
- `TrustSnapshot` — por qué subió o bajó cada score
- `ServiceRequest.motivoPerdida` — por qué se cayó cada solicitud
- `ScopeChange` — cada peso adicional, con foto y decisión del cliente
- `Incident.costoPlataforma` — lo que de verdad cuesta un reclamo

### 4.2 Lo que falta capturar

| Dato | Por qué importa | Sección |
|---|---|---|
| **Tiempo de respuesta** | De solicitud a asignación. Es el SLA | §41 |
| **Tiempo de llegada** | De asignación a check-in real | §41 |
| **Duración real vs estimada** | Corrige el Price Engine con datos | §22, §53 |
| **Origen del cliente** | Sin esto el CAC es inventado | §61 |
| **Motivo de rechazo del profesional** | Revela precio bajo o zona mala | §21 |
| **Materiales realmente usados** | Alimenta el §28 | §28 |
| **Tiempo de reemplazo** | Dice si la promesa es sostenible | §35 |

### 4.3 El tablero administrativo que falta

El §52 pide gestión; el §61 pide métricas. Lo que hay hoy cubre operación diaria.
Falta la vista de **dirección**:

1. **Embudo** — solicitudes → cotizadas → asignadas → ejecutadas → repetidas, con
   los motivos de caída en cada paso.
2. **Unit economics reales** — take rate real, margen por servicio, costo de
   soporte, reserva de garantía **calculada de incidentes reales** y no del 1,5%
   supuesto del §43.
3. **Oferta por zona y habilidad** — dónde falta gente y de qué. Sale de los
   `MatchCandidate` descartados.
4. **Cohortes de recurrencia** — de los clientes de enero, cuántos volvieron.
   Es la respuesta al §62.
5. **Tablero B2B por empresa y sede** — §40.

---

## 5. Plan de pruebas

### 5.1 Pruebas automáticas que faltan

Hoy existe `npm run verificar` (Price Engine contra los ejemplos del documento) y
`npm run probar-db`. Falta:

| Prueba | Qué protege |
|---|---|
| Match: profesional sin habilidad obligatoria queda descartado | §21, el filtro duro |
| Match: habilidad declarada **no** habilita | §16, la promesa central |
| Trust: incidente atribuido al cliente **no** baja el score del profesional | Justicia del score |
| Trust: profesional nuevo no arranca en cero | Onboarding |
| Puerta: código equivocado no inicia y deja rastro | §17 |
| Puerta: no se cierra sin foto del después | §27 |
| Alcance: aprobar sube precio **y** pago al profesional en la proporción | §42 |
| Precio: los 12 servicios del catálogo dan el precio esperado | §22 |

### 5.2 Pruebas con personas reales, en orden

1. **5 servicios con conocidos** — el operador hace todo a mano. Objetivo:
   descubrir qué pregunta falta en el formulario.
2. **20 servicios con clientes reales** — medir tiempo de respuesta y de llegada.
3. **Prueba de reemplazo provocada** — pedirle a un profesional que cancele a
   propósito y cronometrar. Si tarda más de 2 horas, la promesa del §35 no existe.
4. **Prueba de la puerta con un desconocido** — que alguien que no es el
   profesional toque la puerta y pida el código. El cliente debe negarse.
   Es la única forma de saber si el §17 funciona en la vida real.
5. **100 servicios** — recién ahí los unit economics significan algo.

---

## 6. Hoja de ruta

### Fase 0 — Antes de operar (bloqueante)

1. **Autenticación del panel.** Sin esto no se puede operar con datos reales.
2. **Bucket de evidencia privado** en Supabase con la clave de servicio.
3. **Texto de consentimiento** que enumere las fuentes a consultar.

### Fase 1 — Verificación automática (2–3 semanas)

4. Integrar CoreSoft: cédula, Policía, Procuraduría, RNMC.
5. Fuente `CONSULTA_FUENTE_OFICIAL` en el Trust Engine.
6. Reverificación automática: los antecedentes vencen a los 6 meses.

### Fase 2 — Dinero (3–4 semanas)

7. Pasarela de pagos (Wompi o Mercado Pago para Colombia).
8. Liquidación al profesional tras confirmación del cliente.
9. RUT vía DIAN para el soporte fiscal.

### Fase 3 — Los portales (4 semanas)

10. Portal del cliente con historial y garantías vigentes.
11. Portal del profesional con sus trabajos, su Trust y sus pagos.
12. Tablero B2B por empresa y sede.

### Fase 4 — Inteligencia (cuando haya 500+ servicios)

13. Clasificación automática de la solicitud (§18) — **con datos propios**, no antes.
14. Precio ajustado por duración real medida.
15. Detección de anomalías: precio fuera de rango, reclamos al alza.

---

## 7. Las tres decisiones que no son de software

1. **Corregir el modelo financiero.** Hoy el escenario de 36 meses no se sostiene
   con el take rate declarado. Antes de mostrárselo a alguien, reconciliar.
2. **Resolver el arranque en frío.** Sin 30 profesionales verificados en una zona,
   el reemplazo no existe y el diferenciador se cae.
3. **Validación legal colombiana** (§47): independientes vs relación laboral,
   ARL por actividad, y responsabilidad ante un daño en casa del cliente.

El software está listo para el piloto. Lo que falta para operar es mitad producto
y mitad decisiones.
