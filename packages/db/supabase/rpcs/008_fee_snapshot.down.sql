-- Reaplicar create_order_with_event de 001_core.sql ANTES de remover as colunas.
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS order_feepayer_check;
ALTER TABLE "order" DROP COLUMN IF EXISTS "feeRate", DROP COLUMN IF EXISTS "feePayer";
ALTER TABLE category DROP COLUMN IF EXISTS "feeRate";
