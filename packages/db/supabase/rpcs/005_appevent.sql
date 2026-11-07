-- Fase 0: trilha de eventos de produto (métricas do piloto, sem SDK externo).
-- Aditiva: nada lê nem escreve aqui até a Fase 2 instrumentar os fluxos.
CREATE TABLE IF NOT EXISTS appevent (
  "id"        TEXT PRIMARY KEY,
  "type"      TEXT NOT NULL,
  "userId"    TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "orderId"   TEXT REFERENCES "order"("id") ON DELETE SET NULL,
  "props"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appevent_type_createdat_idx ON appevent ("type", "createdAt");
CREATE INDEX IF NOT EXISTS appevent_userid_idx ON appevent ("userId");
CREATE INDEX IF NOT EXISTS appevent_orderid_idx ON appevent ("orderId");
