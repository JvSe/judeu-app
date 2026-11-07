-- Fase 0: parâmetros de negócio editáveis sem deploy (taxa, TTLs, limiares).
-- Aditiva: sem linhas, a API usa os valores padrão de apps/web/src/lib/config.ts,
-- que reproduzem o comportamento atual.
CREATE TABLE IF NOT EXISTS appconfig (
  "key"       TEXT PRIMARY KEY,
  "value"     JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
