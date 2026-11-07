ALTER TABLE refreshtoken DROP COLUMN IF EXISTS "deviceId";
ALTER TABLE providerprofile DROP COLUMN IF EXISTS "reverifyRequiredAt", DROP COLUMN IF EXISTS "reverifyReason", DROP COLUMN IF EXISTS "lastSelfieAt";
