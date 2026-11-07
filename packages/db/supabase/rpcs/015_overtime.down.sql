ALTER TABLE "order" DROP COLUMN IF EXISTS "expectedDurationMin", DROP COLUMN IF EXISTS "overtimeAlertedAt";
ALTER TABLE category DROP COLUMN IF EXISTS "expectedDurationMin";
