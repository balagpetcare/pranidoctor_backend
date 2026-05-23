-- Profile media thumb URLs (backward compatible — existing photo URLs unchanged)
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "profilePhotoThumbUrl" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "coverPhotoThumbUrl" TEXT;
