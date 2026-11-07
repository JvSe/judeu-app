-- Fase 5: reverificação (selfie aleatória antes de começar e ao trocar de
-- aparelho) e vínculo da sessão ao aparelho.
ALTER TABLE providerprofile
  ADD COLUMN IF NOT EXISTS "reverifyRequiredAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reverifyReason" TEXT,
  ADD COLUMN IF NOT EXISTS "lastSelfieAt" TIMESTAMPTZ;
ALTER TABLE refreshtoken ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
