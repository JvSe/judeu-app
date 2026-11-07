-- Fase 5: denúncia, suspensão de cliente e prazo (SLA) do suporte.
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "blockedReason" TEXT;

CREATE TABLE IF NOT EXISTS report (
  "id"             TEXT PRIMARY KEY,
  "reporterId"     TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "reportedUserId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "orderId"        TEXT REFERENCES "order"("id") ON DELETE SET NULL,
  "reason"         TEXT NOT NULL CHECK ("reason" IN ('SAFETY', 'BEHAVIOR', 'FRAUD', 'NO_SHOW', 'OTHER')),
  "details"        TEXT,
  "status"         TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'REVIEWED')),
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_status_idx ON report ("status", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS report_once_per_order ON report ("reporterId", "orderId");

ALTER TABLE supportticket
  ADD COLUMN IF NOT EXISTS "slaDueAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMPTZ;
