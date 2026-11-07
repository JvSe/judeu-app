DROP INDEX IF EXISTS user_acquisitionchannel_idx;
ALTER TABLE "user" DROP COLUMN IF EXISTS "acquisitionChannel", DROP COLUMN IF EXISTS "acquisitionCode";
