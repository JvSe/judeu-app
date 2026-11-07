DROP INDEX IF EXISTS order_sharetoken_key;
ALTER TABLE "order" DROP COLUMN IF EXISTS "shareToken";
ALTER TABLE "user" DROP COLUMN IF EXISTS "trustedContactName", DROP COLUMN IF EXISTS "trustedContactEmail";
