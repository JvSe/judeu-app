-- Fase 6: zonas e horário de operação. Sem nenhuma zona ATIVA, tudo continua
-- liberado como antes (a regra só vale depois que o admin cadastra uma zona).
-- polygon: lista de pontos [lat, lng] (sem PostGIS; o teste ponto-no-polígono
-- é feito na API). Horários em minutos do dia, hora de Brasília (UTC−3).
-- closeMinute < openMinute = janela que passa da meia-noite.
CREATE TABLE IF NOT EXISTS servicezone (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "polygon"     JSONB NOT NULL,
  "weekdays"    INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  "openMinute"  INT NOT NULL DEFAULT 0 CHECK ("openMinute" BETWEEN 0 AND 1439),
  "closeMinute" INT NOT NULL DEFAULT 1440 CHECK ("closeMinute" BETWEEN 1 AND 1440),
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
