-- Veterinary advice disclaimer acceptance + audit type

ALTER TYPE "LegalConsentType" ADD VALUE IF NOT EXISTS 'VET_ADVICE';

ALTER TABLE "MobileUserSettings"
  ADD COLUMN IF NOT EXISTS "vetAcceptedVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "vetAcceptedAt" TIMESTAMP(3);
