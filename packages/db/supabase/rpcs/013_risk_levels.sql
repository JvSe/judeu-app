-- Fase 5: níveis de tarefa e selos. Toda categoria nasce nível 1 (qualquer
-- pessoa aprovada atende) — nada muda até o admin classificar as categorias.
-- 1 = livre · 2 = exige selo de reparos (ou profissional) · 3 = só profissional
-- com credencial · 4 = proibido no app.
ALTER TABLE category ADD COLUMN IF NOT EXISTS "riskLevel" INT NOT NULL DEFAULT 1
  CHECK ("riskLevel" BETWEEN 1 AND 4);
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "riskLevel" INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS providerbadge (
  "id"         TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES providerprofile("id") ON DELETE CASCADE,
  "type"       TEXT NOT NULL CHECK ("type" IN ('REPAIRS_SEAL', 'PRO_CREDENTIAL')),
  "note"       TEXT,
  "grantedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt"  TIMESTAMPTZ,
  UNIQUE ("providerId", "type")
);
