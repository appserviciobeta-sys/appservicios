-- Registro de cobros y giros.
--
-- Se aplica a mano en el editor SQL de Supabase porque las credenciales
-- locales de la base no sirven y `prisma migrate` no puede correr desde aquí.
--
-- Es idempotente: si lo corres dos veces no rompe nada.

-- 1. Cobros al cliente. Varios por orden: los abonos existen.
CREATE TABLE IF NOT EXISTS "Payment" (
    "id"             TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "monto"          INTEGER NOT NULL,
    "metodo"         TEXT NOT NULL,
    "proveedor"      TEXT NOT NULL DEFAULT 'MANUAL',
    "referencia"     TEXT NOT NULL DEFAULT '',
    "estado"         TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "recibidoAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registradoPor"  TEXT NOT NULL DEFAULT '',
    "notas"          TEXT NOT NULL DEFAULT '',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Payment_serviceOrderId_idx" ON "Payment" ("serviceOrderId");
CREATE INDEX IF NOT EXISTS "Payment_recibidoAt_idx"     ON "Payment" ("recibidoAt");
CREATE INDEX IF NOT EXISTS "Payment_estado_idx"         ON "Payment" ("estado");

-- 2. Giros al profesional. Uno cubre varios servicios, como se paga de verdad.
CREATE TABLE IF NOT EXISTS "Payout" (
    "id"             TEXT NOT NULL,
    "codigo"         TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "monto"          INTEGER NOT NULL,
    "metodo"         TEXT NOT NULL DEFAULT 'TRANSFERENCIA',
    "referencia"     TEXT NOT NULL DEFAULT '',
    "estado"         TEXT NOT NULL DEFAULT 'PENDIENTE',
    "pagadoAt"       TIMESTAMP(3),
    "registradoPor"  TEXT NOT NULL DEFAULT '',
    "notas"          TEXT NOT NULL DEFAULT '',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payout_codigo_key"     ON "Payout" ("codigo");
CREATE INDEX        IF NOT EXISTS "Payout_professionalId_idx" ON "Payout" ("professionalId");
CREATE INDEX        IF NOT EXISTS "Payout_estado_idx"         ON "Payout" ("estado");
CREATE INDEX        IF NOT EXISTS "Payout_createdAt_idx"      ON "Payout" ("createdAt");

-- 3. Qué servicio entró en qué giro.
--
--    El índice único es lo que impide pagar dos veces el mismo trabajo. Una
--    liquidación duplicada no se nota hasta que se cuadra el mes.
CREATE TABLE IF NOT EXISTS "PayoutItem" (
    "id"             TEXT NOT NULL,
    "payoutId"       TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "monto"          INTEGER NOT NULL,
    CONSTRAINT "PayoutItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayoutItem_payoutId_serviceOrderId_key"
  ON "PayoutItem" ("payoutId", "serviceOrderId");
CREATE INDEX IF NOT EXISTS "PayoutItem_serviceOrderId_idx"
  ON "PayoutItem" ("serviceOrderId");

-- 4. Llaves foráneas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_serviceOrderId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_serviceOrderId_fkey"
      FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payout_professionalId_fkey') THEN
    ALTER TABLE "Payout" ADD CONSTRAINT "Payout_professionalId_fkey"
      FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayoutItem_payoutId_fkey') THEN
    ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_payoutId_fkey"
      FOREIGN KEY ("payoutId") REFERENCES "Payout"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayoutItem_serviceOrderId_fkey') THEN
    ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_serviceOrderId_fkey"
      FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Las órdenes que decían "COBRADO" a mano nunca tuvieron un cobro detrás.
--    Se devuelven al estado que corresponde según los hechos: si el cliente
--    confirmó, quedan por cobrar; si no, sin autorizar. Es preferible una
--    cuenta que pide revisión a una que dice que ya entró plata que no entró.
UPDATE "ServiceOrder"
SET "estadoPago" = CASE
      WHEN "confirmacionCliente" = 'OK' THEN 'AUTORIZADO'
      ELSE 'PENDIENTE'
    END
WHERE "estadoPago" IN ('COBRADO', 'LIQUIDADO')
  AND NOT EXISTS (
    SELECT 1 FROM "Payment" p WHERE p."serviceOrderId" = "ServiceOrder"."id"
  );
