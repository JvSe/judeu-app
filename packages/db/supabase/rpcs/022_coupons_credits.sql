-- Fase 6: cupons e crédito do cliente. O desconto sai da parte da plataforma:
-- o cliente paga menos e quem atende recebe o mesmo de antes.
-- Pedidos existentes ficam com desconto 0 (nada muda para eles).
CREATE TABLE IF NOT EXISTS coupon (
  "id"               TEXT PRIMARY KEY,
  "code"             TEXT NOT NULL UNIQUE,
  "kind"             TEXT NOT NULL CHECK ("kind" IN ('PERCENT', 'FIXED')),
  -- PERCENT: 1–100 · FIXED: centavos.
  "value"            INT NOT NULL CHECK ("value" > 0),
  "maxDiscountCents" INT,
  "minPriceCents"    INT,
  "maxRedemptions"   INT,
  "perUserLimit"     INT NOT NULL DEFAULT 1,
  "firstOrderOnly"   BOOLEAN NOT NULL DEFAULT false,
  "startsAt"         TIMESTAMPTZ,
  "expiresAt"        TIMESTAMPTZ,
  "active"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS couponredemption (
  "id"            TEXT PRIMARY KEY,
  "couponId"      TEXT NOT NULL REFERENCES coupon("id") ON DELETE CASCADE,
  "userId"        TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "orderId"       TEXT NOT NULL UNIQUE REFERENCES "order"("id") ON DELETE CASCADE,
  "discountCents" INT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS couponredemption_coupon_idx ON couponredemption ("couponId");
CREATE INDEX IF NOT EXISTS couponredemption_user_idx ON couponredemption ("userId");

-- Livro do crédito: + concessão/devolução, − uso num pedido. Saldo = soma.
CREATE TABLE IF NOT EXISTS clientcredit (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "amountCents" INT NOT NULL CHECK ("amountCents" <> 0),
  "kind"        TEXT NOT NULL CHECK ("kind" IN ('GRANT', 'USE', 'REFUND')),
  "reason"      TEXT,
  "orderId"     TEXT REFERENCES "order"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clientcredit_user_idx ON clientcredit ("userId");
-- Um uso e uma devolução por pedido, no máximo.
CREATE UNIQUE INDEX IF NOT EXISTS clientcredit_order_kind_uq ON clientcredit ("orderId", "kind")
  WHERE "orderId" IS NOT NULL AND "kind" IN ('USE', 'REFUND');

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "discountCents" INT NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "creditUsedCents" INT NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "couponId" TEXT REFERENCES coupon("id") ON DELETE SET NULL;
