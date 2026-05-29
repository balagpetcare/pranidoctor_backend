-- Legal consent audit trail + AI acceptance on mobile settings

CREATE TYPE "LegalConsentType" AS ENUM ('PRIVACY', 'TERMS', 'AI_PROCESSING');

ALTER TABLE "MobileUserSettings"
  ADD COLUMN IF NOT EXISTS "aiAcceptedVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "aiAcceptedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "LegalConsentEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "consentType" "LegalConsentType" NOT NULL,
  "version" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'MOBILE',
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LegalConsentEvent_userId_createdAt_idx"
  ON "LegalConsentEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LegalConsentEvent_consentType_createdAt_idx"
  ON "LegalConsentEvent"("consentType", "createdAt");

ALTER TABLE "LegalConsentEvent"
  ADD CONSTRAINT "LegalConsentEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
