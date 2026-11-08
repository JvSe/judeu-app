-- Fase 6: âncoras com piso por hora. Um turno (plantão) garante a quem atende
-- um piso proporcional ao tempo em que ficou disponível. No fim do turno, se o
-- que ganhou nos pedidos aceitos no turno ficar abaixo do piso, a diferença
-- entra na carteira como complemento. Aditiva: sem turnos, nada muda.
CREATE TABLE IF NOT EXISTS anchorshift (
  "id"               TEXT PRIMARY KEY,
  "providerId"       TEXT NOT NULL REFERENCES providerprofile("id") ON DELETE CASCADE,
  "startsAt"         TIMESTAMPTZ NOT NULL,
  "endsAt"           TIMESTAMPTZ NOT NULL,
  "hourlyFloorCents" INT NOT NULL CHECK ("hourlyFloorCents" >= 0),
  "onlineMinutes"    INT NOT NULL DEFAULT 0,
  "lastPresenceAt"   TIMESTAMPTZ,
  "status"           TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK ("status" IN ('SCHEDULED', 'SETTLED', 'CANCELLED')),
  "earnedCents"      INT,
  "subsidyCents"     INT,
  "settledAt"        TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ("endsAt" > "startsAt")
);
CREATE INDEX IF NOT EXISTS anchorshift_status_ends_idx ON anchorshift ("status", "endsAt");
CREATE INDEX IF NOT EXISTS anchorshift_provider_idx ON anchorshift ("providerId");
