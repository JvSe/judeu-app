-- Fase 5: duração prevista por categoria e alerta de tempo excedido.
ALTER TABLE category ADD COLUMN IF NOT EXISTS "expectedDurationMin" INT;
ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS "expectedDurationMin" INT,
  ADD COLUMN IF NOT EXISTS "overtimeAlertedAt" TIMESTAMPTZ;
