-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "riesgo" TEXT NOT NULL DEFAULT 'BAJO',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "riesgo" TEXT NOT NULL DEFAULT 'BAJO',
    "requiereCertificacion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "modeloPrecio" TEXT NOT NULL DEFAULT 'FIJO',
    "precioBase" INTEGER NOT NULL DEFAULT 0,
    "unidadBase" TEXT NOT NULL DEFAULT 'servicio',
    "duracionMinMin" INTEGER NOT NULL DEFAULT 60,
    "duracionMaxMin" INTEGER NOT NULL DEFAULT 120,
    "porcentajeProfesional" INTEGER NOT NULL DEFAULT 80,
    "garantiaDias" INTEGER NOT NULL DEFAULT 0,
    "riesgo" TEXT NOT NULL DEFAULT 'BAJO',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTypeSkill" (
    "id" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceTypeSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'ADICION',
    "valor" INTEGER NOT NULL DEFAULT 0,
    "campo" TEXT NOT NULL DEFAULT '',
    "valorEsperado" TEXT NOT NULL DEFAULT '',
    "umbral" INTEGER NOT NULL DEFAULT 0,
    "minutos" INTEGER NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL DEFAULT 'CC',
    "documento" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "celular" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "ciudad" TEXT NOT NULL,
    "zonas" TEXT NOT NULL DEFAULT '',
    "fotoUrl" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "nivel" TEXT NOT NULL DEFAULT 'INICIAL',
    "trustScore" INTEGER NOT NULL DEFAULT 50,
    "trustDesglose" TEXT NOT NULL DEFAULT '{}',
    "aniosExperiencia" INTEGER NOT NULL DEFAULT 0,
    "experienciaTexto" TEXT NOT NULL DEFAULT '',
    "notasInternas" TEXT NOT NULL DEFAULT '',
    "aceptaDatos" BOOLEAN NOT NULL DEFAULT false,
    "aceptaDatosEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalSkill" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'DECLARADA',
    "fuente" TEXT NOT NULL DEFAULT '',
    "nota" TEXT NOT NULL DEFAULT '',
    "verificadoPor" TEXT,
    "verificadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalDocument" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivoRiesgo" TEXT NOT NULL,
    "numero" TEXT NOT NULL DEFAULT '',
    "archivoUrl" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "emitidoEn" TIMESTAMP(3),
    "venceEn" TIMESTAMP(3),
    "verificadoPor" TEXT,
    "verificadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" INTEGER NOT NULL,
    "horaFin" INTEGER NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PERSONA',
    "nombre" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "ciudad" TEXT NOT NULL DEFAULT '',
    "zona" TEXT NOT NULL DEFAULT '',
    "direccion" TEXT NOT NULL DEFAULT '',
    "razonSocial" TEXT NOT NULL DEFAULT '',
    "nit" TEXT NOT NULL DEFAULT '',
    "contactoNombre" TEXT NOT NULL DEFAULT '',
    "contactoCargo" TEXT NOT NULL DEFAULT '',
    "sedes" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "origen" TEXT NOT NULL DEFAULT 'SOLICITUD',
    "trustScore" INTEGER NOT NULL DEFAULT 70,
    "notasInternas" TEXT NOT NULL DEFAULT '',
    "aceptaDatos" BOOLEAN NOT NULL DEFAULT false,
    "aceptaDatosEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSite" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "zona" TEXT NOT NULL DEFAULT '',
    "ciudad" TEXT NOT NULL DEFAULT '',
    "contacto" TEXT NOT NULL DEFAULT '',
    "celular" TEXT NOT NULL DEFAULT '',
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClientSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "textoCliente" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'WEB',
    "categoryId" TEXT,
    "serviceTypeId" TEXT,
    "urgencia" TEXT NOT NULL DEFAULT 'PROGRAMADO',
    "fechaDeseada" TIMESTAMP(3),
    "direccion" TEXT NOT NULL DEFAULT '',
    "zona" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'NUEVA',
    "motivoPerdida" TEXT NOT NULL DEFAULT '',
    "riesgo" TEXT NOT NULL DEFAULT 'BAJO',
    "respuestas" TEXT NOT NULL DEFAULT '{}',
    "notasInternas" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "precioTotal" INTEGER NOT NULL,
    "precioProfesional" INTEGER NOT NULL,
    "comision" INTEGER NOT NULL,
    "duracionEstimadaMin" INTEGER NOT NULL DEFAULT 60,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "generadoPor" TEXT NOT NULL DEFAULT 'PRICE_ENGINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchCandidate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "desglose" TEXT NOT NULL DEFAULT '{}',
    "estado" TEXT NOT NULL DEFAULT 'SUGERIDO',
    "motivo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "quoteId" TEXT,
    "clientId" TEXT NOT NULL,
    "professionalId" TEXT,
    "serviceTypeId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ASIGNADA',
    "codigoServicio" TEXT NOT NULL,
    "palabraSeguridad" TEXT NOT NULL DEFAULT '',
    "tokenProfesional" TEXT,
    "tokenCliente" TEXT,
    "programadoPara" TIMESTAMP(3),
    "llegadaEsperada" TIMESTAMP(3),
    "enCaminoAt" TIMESTAMP(3),
    "llegadaAt" TIMESTAMP(3),
    "checkInAt" TIMESTAMP(3),
    "checkInLat" DOUBLE PRECISION,
    "checkInLng" DOUBLE PRECISION,
    "checkOutAt" TIMESTAMP(3),
    "checkOutLat" DOUBLE PRECISION,
    "checkOutLng" DOUBLE PRECISION,
    "confirmadoClienteAt" TIMESTAMP(3),
    "confirmacionCliente" TEXT NOT NULL DEFAULT '',
    "precioCliente" INTEGER NOT NULL DEFAULT 0,
    "pagoProfesional" INTEGER NOT NULL DEFAULT 0,
    "comision" INTEGER NOT NULL DEFAULT 0,
    "costoMateriales" INTEGER NOT NULL DEFAULT 0,
    "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "garantiaHasta" TIMESTAMP(3),
    "notasInternas" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeChange" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fotoUrl" TEXT NOT NULL DEFAULT '',
    "precioAdicional" INTEGER NOT NULL DEFAULT 0,
    "minutosAdicionales" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'SOLICITADO',
    "solicitadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoAt" TIMESTAMP(3),

    CONSTRAINT "ScopeChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialItem" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidad" TEXT NOT NULL DEFAULT 'und',
    "precioUnitario" INTEGER NOT NULL DEFAULT 0,
    "proveedor" TEXT NOT NULL DEFAULT '',
    "aprobado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "nota" TEXT NOT NULL DEFAULT '',
    "subidoPor" TEXT NOT NULL DEFAULT 'OPERADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "emisor" TEXT NOT NULL,
    "calidad" INTEGER,
    "puntualidad" INTEGER,
    "comunicacion" INTEGER,
    "comentario" TEXT NOT NULL DEFAULT '',
    "recomendaria" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "reportadoPor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "severidad" TEXT NOT NULL DEFAULT 'BAJO',
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "resolucion" TEXT NOT NULL DEFAULT '',
    "costoPlataforma" INTEGER NOT NULL DEFAULT 0,
    "responsable" TEXT NOT NULL DEFAULT 'NINGUNO',
    "abiertoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Replacement" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "profesionalSalienteId" TEXT,
    "profesionalEntranteId" TEXT,
    "minutosParaReemplazo" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'SOLICITADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoAt" TIMESTAMP(3),

    CONSTRAINT "Replacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'sistema',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustSnapshot" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "desglose" TEXT NOT NULL DEFAULT '{}',
    "motivo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE INDEX "Skill_categoryId_idx" ON "Skill"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_slug_key" ON "ServiceType"("slug");

-- CreateIndex
CREATE INDEX "ServiceType_categoryId_idx" ON "ServiceType"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTypeSkill_serviceTypeId_skillId_key" ON "ServiceTypeSkill"("serviceTypeId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceRule_serviceTypeId_codigo_key" ON "PriceRule"("serviceTypeId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_codigo_key" ON "Professional"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_documento_key" ON "Professional"("documento");

-- CreateIndex
CREATE INDEX "Professional_estado_idx" ON "Professional"("estado");

-- CreateIndex
CREATE INDEX "Professional_ciudad_idx" ON "Professional"("ciudad");

-- CreateIndex
CREATE INDEX "ProfessionalSkill_estado_idx" ON "ProfessionalSkill"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalSkill_professionalId_skillId_key" ON "ProfessionalSkill"("professionalId", "skillId");

-- CreateIndex
CREATE INDEX "ProfessionalDocument_professionalId_idx" ON "ProfessionalDocument"("professionalId");

-- CreateIndex
CREATE INDEX "ProfessionalDocument_estado_venceEn_idx" ON "ProfessionalDocument"("estado", "venceEn");

-- CreateIndex
CREATE INDEX "Availability_professionalId_diaSemana_idx" ON "Availability"("professionalId", "diaSemana");

-- CreateIndex
CREATE UNIQUE INDEX "Client_codigo_key" ON "Client"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Client_celular_key" ON "Client"("celular");

-- CreateIndex
CREATE INDEX "Client_tipo_idx" ON "Client"("tipo");

-- CreateIndex
CREATE INDEX "Client_estado_idx" ON "Client"("estado");

-- CreateIndex
CREATE INDEX "ClientSite_clientId_idx" ON "ClientSite"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_codigo_key" ON "ServiceRequest"("codigo");

-- CreateIndex
CREATE INDEX "ServiceRequest_estado_idx" ON "ServiceRequest"("estado");

-- CreateIndex
CREATE INDEX "ServiceRequest_createdAt_idx" ON "ServiceRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Quote_requestId_idx" ON "Quote"("requestId");

-- CreateIndex
CREATE INDEX "MatchCandidate_estado_idx" ON "MatchCandidate"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "MatchCandidate_requestId_professionalId_key" ON "MatchCandidate"("requestId", "professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_codigo_key" ON "ServiceOrder"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_tokenProfesional_key" ON "ServiceOrder"("tokenProfesional");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_tokenCliente_key" ON "ServiceOrder"("tokenCliente");

-- CreateIndex
CREATE INDEX "ServiceOrder_estado_idx" ON "ServiceOrder"("estado");

-- CreateIndex
CREATE INDEX "ServiceOrder_professionalId_idx" ON "ServiceOrder"("professionalId");

-- CreateIndex
CREATE INDEX "ServiceOrder_createdAt_idx" ON "ServiceOrder"("createdAt");

-- CreateIndex
CREATE INDEX "ScopeChange_serviceOrderId_idx" ON "ScopeChange"("serviceOrderId");

-- CreateIndex
CREATE INDEX "MaterialItem_serviceOrderId_idx" ON "MaterialItem"("serviceOrderId");

-- CreateIndex
CREATE INDEX "Evidence_serviceOrderId_idx" ON "Evidence"("serviceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_serviceOrderId_emisor_key" ON "Rating"("serviceOrderId", "emisor");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_codigo_key" ON "Incident"("codigo");

-- CreateIndex
CREATE INDEX "Incident_estado_severidad_idx" ON "Incident"("estado", "severidad");

-- CreateIndex
CREATE INDEX "Replacement_serviceOrderId_idx" ON "Replacement"("serviceOrderId");

-- CreateIndex
CREATE INDEX "EventLog_entidad_entidadId_idx" ON "EventLog"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "EventLog_tipo_createdAt_idx" ON "EventLog"("tipo", "createdAt");

-- CreateIndex
CREATE INDEX "TrustSnapshot_professionalId_createdAt_idx" ON "TrustSnapshot"("professionalId", "createdAt");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceType" ADD CONSTRAINT "ServiceType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTypeSkill" ADD CONSTRAINT "ServiceTypeSkill_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTypeSkill" ADD CONSTRAINT "ServiceTypeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSkill" ADD CONSTRAINT "ProfessionalSkill_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSkill" ADD CONSTRAINT "ProfessionalSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalDocument" ADD CONSTRAINT "ProfessionalDocument_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSite" ADD CONSTRAINT "ClientSite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ClientSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeChange" ADD CONSTRAINT "ScopeChange_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialItem" ADD CONSTRAINT "MaterialItem_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_profesionalSalienteId_fkey" FOREIGN KEY ("profesionalSalienteId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_profesionalEntranteId_fkey" FOREIGN KEY ("profesionalEntranteId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustSnapshot" ADD CONSTRAINT "TrustSnapshot_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
