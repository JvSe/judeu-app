-- Fase 6: escalonamento da ajuda aberta sem aceite.
-- 0 = só o público normal · 1 = âncoras de plantão avisados · 2 = raio ampliado.
-- Pedidos existentes ficam em 0 (nada muda para eles).
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "escalationLevel" INT NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMPTZ;
