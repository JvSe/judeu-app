-- Fase 2: atribuição de canal (CAC por canal no painel de métricas).
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "acquisitionChannel" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisitionCode" TEXT;
CREATE INDEX IF NOT EXISTS user_acquisitionchannel_idx ON "user" ("acquisitionChannel");
