-- Legal document registry + versioned acceptance audit (additive)

CREATE TYPE "LegalAcceptanceMethod" AS ENUM (
  'EXPLICIT_BUTTON',
  'CHECKBOX_REGISTER',
  'PROVIDER_ONBOARDING',
  'FORCED_RECONSENT',
  'ADMIN_ATTESTED'
);

CREATE TABLE "LegalDocument" (
  "id" TEXT NOT NULL,
  "documentKey" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "contentMarkdown" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "publicUrl" TEXT,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "requiresReaccept" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "tenantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalDocument_documentKey_version_locale_tenantId_key"
  ON "LegalDocument"("documentKey", "version", "locale", "tenantId");
CREATE INDEX "LegalDocument_documentKey_locale_effectiveAt_idx"
  ON "LegalDocument"("documentKey", "locale", "effectiveAt");
CREATE INDEX "LegalDocument_tenantId_idx" ON "LegalDocument"("tenantId");

CREATE TABLE "LegalAcceptanceEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "legalDocumentId" TEXT NOT NULL,
  "documentKey" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "appSurface" TEXT NOT NULL,
  "appVersion" TEXT,
  "method" "LegalAcceptanceMethod" NOT NULL DEFAULT 'EXPLICIT_BUTTON',
  "metadataJson" JSONB,

  CONSTRAINT "LegalAcceptanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegalAcceptanceEvent_userId_documentKey_acceptedAt_idx"
  ON "LegalAcceptanceEvent"("userId", "documentKey", "acceptedAt");
CREATE INDEX "LegalAcceptanceEvent_legalDocumentId_idx"
  ON "LegalAcceptanceEvent"("legalDocumentId");
CREATE INDEX "LegalAcceptanceEvent_acceptedAt_idx"
  ON "LegalAcceptanceEvent"("acceptedAt");

ALTER TABLE "LegalAcceptanceEvent"
  ADD CONSTRAINT "LegalAcceptanceEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegalAcceptanceEvent"
  ADD CONSTRAINT "LegalAcceptanceEvent_legalDocumentId_fkey"
  FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "AuthAuditAction" ADD VALUE IF NOT EXISTS 'LEGAL_ACCEPTED';
