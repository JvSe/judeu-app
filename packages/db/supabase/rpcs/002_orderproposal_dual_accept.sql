-- Dual accept fields for open-help price adjustment
ALTER TABLE orderproposal
  ADD COLUMN IF NOT EXISTS "clientAcceptedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "providerAcceptedAt" TIMESTAMPTZ;
