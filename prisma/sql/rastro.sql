-- Rastro del profesional en camino.
--
-- Se aplica a mano en el editor SQL de Supabase porque las credenciales
-- locales de la base no sirven y `prisma migrate` no puede correr desde aquí.
--
-- Es idempotente: si lo corres dos veces no rompe nada.

-- 1. Dónde queda la casa del cliente. Lo marca él mismo desde su pantalla de
--    seguimiento; no se geocodifica la dirección escrita.
ALTER TABLE "ServiceOrder"
  ADD COLUMN IF NOT EXISTS "destinoLat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "destinoLng" DOUBLE PRECISION;

-- 2. Las señales de ubicación durante el trayecto.
--
--    ON DELETE CASCADE no es un detalle: si se borra la orden, el recorrido de
--    una persona se va con ella. No debe quedar huérfano en la base.
CREATE TABLE IF NOT EXISTS "LocationPing" (
    "id"             TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "lat"            DOUBLE PRECISION NOT NULL,
    "lng"            DOUBLE PRECISION NOT NULL,
    "precisionM"     DOUBLE PRECISION,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LocationPing_serviceOrderId_createdAt_idx"
  ON "LocationPing" ("serviceOrderId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LocationPing_serviceOrderId_fkey'
  ) THEN
    ALTER TABLE "LocationPing"
      ADD CONSTRAINT "LocationPing_serviceOrderId_fkey"
      FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
