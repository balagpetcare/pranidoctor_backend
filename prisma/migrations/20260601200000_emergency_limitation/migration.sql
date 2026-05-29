-- Emergency service limitation notice — acceptance + audit consent type
ALTER TABLE "MobileUserSettings" ADD COLUMN IF NOT EXISTS "emergencyAcceptedVersion" TEXT;
ALTER TABLE "MobileUserSettings" ADD COLUMN IF NOT EXISTS "emergencyAcceptedAt" TIMESTAMP(3);

ALTER TYPE "LegalConsentType" ADD VALUE IF NOT EXISTS 'EMERGENCY_SERVICE';
