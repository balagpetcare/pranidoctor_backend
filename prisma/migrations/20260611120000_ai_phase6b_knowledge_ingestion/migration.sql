-- Phase 6B: Knowledge ingestion — source registry, import runs, chunks, review workflows

-- Extend knowledge entry lifecycle
ALTER TYPE "AiKnowledgeStatus" ADD VALUE IF NOT EXISTS 'VET_APPROVAL';
ALTER TYPE "AiKnowledgeStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "AiKnowledgeStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

CREATE TYPE "AiKnowledgeSourceClass" AS ENUM (
  'VETERINARY_TEXTBOOK',
  'CLINICAL_PROTOCOL',
  'BPA_GUIDELINE',
  'WPA_GUIDELINE',
  'GOVT_LIVESTOCK',
  'VACCINE_SCHEDULE',
  'MEDICINE_REFERENCE',
  'FEED_REFERENCE',
  'BREED_REFERENCE',
  'EMERGENCY_PROTOCOL'
);

CREATE TYPE "AiKnowledgeCatalogSourceType" AS ENUM (
  'PEER_REVIEWED',
  'GOVT_EXTENSION',
  'TEXTBOOK',
  'MANUFACTURER_LABEL',
  'FIELD_TRIAL',
  'EXPERT_CONSENSUS',
  'INTERNAL_SOP'
);

CREATE TYPE "AiKnowledgeSourceStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'RETIRED');

CREATE TYPE "AiKnowledgeLicenseType" AS ENUM (
  'PUBLIC_DOMAIN',
  'GOVT_OPEN',
  'PURCHASED',
  'SUBSCRIPTION',
  'PARTNER_MO',
  'INTERNAL'
);

CREATE TYPE "AiKnowledgeDocumentMediaType" AS ENUM (
  'PDF',
  'DOCX',
  'CSV',
  'JSON',
  'HTML',
  'API_SNAPSHOT'
);

CREATE TYPE "AiKnowledgeImportRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

CREATE TYPE "AiKnowledgeReviewStage" AS ENUM ('EDITORIAL', 'VET');

CREATE TYPE "AiKnowledgeReviewDecision" AS ENUM ('APPROVE', 'REQUEST_CHANGES', 'REJECT');

CREATE TYPE "AiKnowledgeEvidenceLevel" AS ENUM ('L1', 'L2', 'L3', 'L4', 'L5');

CREATE TYPE "AiKnowledgeClinicalRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "AiKnowledgeChunkStage" AS ENUM ('STAGING', 'PUBLISHED');

CREATE TYPE "AiKnowledgeEmbeddingStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'NOT_APPLICABLE');

CREATE TABLE "AiKnowledgeSourceLicense" (
    "id" TEXT NOT NULL,
    "licenseType" "AiKnowledgeLicenseType" NOT NULL,
    "allowsAiExtraction" BOOLEAN NOT NULL DEFAULT true,
    "allowsFarmerDistribution" BOOLEAN NOT NULL DEFAULT true,
    "allowsVerbatimQuote" BOOLEAN NOT NULL DEFAULT false,
    "expiryDate" TIMESTAMP(3),
    "attributionTemplateBn" TEXT,
    "attributionTemplateEn" TEXT,
    "rightsNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeSourceLicense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiKnowledgeSourceLicense_licenseType_idx" ON "AiKnowledgeSourceLicense"("licenseType");

CREATE TABLE "AiKnowledgeSource" (
    "id" TEXT NOT NULL,
    "sourceKey" VARCHAR(128) NOT NULL,
    "sourceClass" "AiKnowledgeSourceClass" NOT NULL,
    "sourceType" "AiKnowledgeCatalogSourceType" NOT NULL,
    "titleBn" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "publisher" TEXT,
    "publishYear" INTEGER,
    "edition" TEXT,
    "jurisdiction" VARCHAR(16) NOT NULL DEFAULT 'BD',
    "trustTier" INTEGER NOT NULL DEFAULT 2,
    "defaultEvidenceLevel" "AiKnowledgeEvidenceLevel" NOT NULL DEFAULT 'L2',
    "allowedDomains" "AiKnowledgeContentType"[],
    "licenseId" TEXT,
    "refreshPolicyDays" INTEGER,
    "status" "AiKnowledgeSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiKnowledgeSource_sourceKey_key" ON "AiKnowledgeSource"("sourceKey");
CREATE INDEX "AiKnowledgeSource_sourceClass_status_idx" ON "AiKnowledgeSource"("sourceClass", "status");
CREATE INDEX "AiKnowledgeSource_status_idx" ON "AiKnowledgeSource"("status");

ALTER TABLE "AiKnowledgeSource" ADD CONSTRAINT "AiKnowledgeSource_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "AiKnowledgeSourceLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AiKnowledgeSourceDocument" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "documentVersion" VARCHAR(64) NOT NULL,
    "mediaType" "AiKnowledgeDocumentMediaType" NOT NULL,
    "storageUri" VARCHAR(512) NOT NULL,
    "checksumSha256" VARCHAR(64) NOT NULL,
    "pageCount" INTEGER,
    "languagePrimary" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "parseProfileId" VARCHAR(64),
    "rightsNote" TEXT,
    "supersedesDocumentId" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeSourceDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiKnowledgeSourceDocument_sourceId_checksumSha256_key"
  ON "AiKnowledgeSourceDocument"("sourceId", "checksumSha256");
CREATE INDEX "AiKnowledgeSourceDocument_sourceId_ingestedAt_idx"
  ON "AiKnowledgeSourceDocument"("sourceId", "ingestedAt");

ALTER TABLE "AiKnowledgeSourceDocument" ADD CONSTRAINT "AiKnowledgeSourceDocument_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "AiKnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiKnowledgeImportRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "documentId" TEXT,
    "adapterId" VARCHAR(64) NOT NULL,
    "pipelineVersion" VARCHAR(16) NOT NULL DEFAULT '1.0.0',
    "status" "AiKnowledgeImportRunStatus" NOT NULL DEFAULT 'RUNNING',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "triggeredById" TEXT,
    "statsJson" JSONB,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiKnowledgeImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiKnowledgeImportRun_sourceId_startedAt_idx" ON "AiKnowledgeImportRun"("sourceId", "startedAt");
CREATE INDEX "AiKnowledgeImportRun_status_startedAt_idx" ON "AiKnowledgeImportRun"("status", "startedAt");

ALTER TABLE "AiKnowledgeImportRun" ADD CONSTRAINT "AiKnowledgeImportRun_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "AiKnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiKnowledgeImportRun" ADD CONSTRAINT "AiKnowledgeImportRun_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "AiKnowledgeSourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "approvedByVetId" TEXT;
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "importRunId" TEXT;
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "chunkPolicyId" VARCHAR(64);
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "evidenceLevel" "AiKnowledgeEvidenceLevel";
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "provisionalEvidenceLevel" "AiKnowledgeEvidenceLevel";
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "confidenceScore" DOUBLE PRECISION;
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "provisionalConfidenceScore" DOUBLE PRECISION;
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "clinicalRiskTier" "AiKnowledgeClinicalRiskTier" NOT NULL DEFAULT 'LOW';
ALTER TABLE "AiKnowledgeEntry" ADD COLUMN "embeddingStatus" "AiKnowledgeEmbeddingStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

CREATE INDEX "AiKnowledgeEntry_sourceId_idx" ON "AiKnowledgeEntry"("sourceId");
CREATE INDEX "AiKnowledgeEntry_importRunId_idx" ON "AiKnowledgeEntry"("importRunId");
CREATE INDEX "AiKnowledgeEntry_clinicalRiskTier_status_idx" ON "AiKnowledgeEntry"("clinicalRiskTier", "status");

ALTER TABLE "AiKnowledgeEntry" ADD CONSTRAINT "AiKnowledgeEntry_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "AiKnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiKnowledgeEntry" ADD CONSTRAINT "AiKnowledgeEntry_importRunId_fkey"
  FOREIGN KEY ("importRunId") REFERENCES "AiKnowledgeImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AiKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkPolicyId" VARCHAR(64) NOT NULL,
    "stage" "AiKnowledgeChunkStage" NOT NULL DEFAULT 'STAGING',
    "contentBn" TEXT NOT NULL,
    "contentEn" TEXT NOT NULL,
    "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "headingPath" VARCHAR(256),
    "citationJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiKnowledgeChunk_knowledgeEntryId_chunkIndex_stage_key"
  ON "AiKnowledgeChunk"("knowledgeEntryId", "chunkIndex", "stage");
CREATE INDEX "AiKnowledgeChunk_knowledgeEntryId_stage_idx" ON "AiKnowledgeChunk"("knowledgeEntryId", "stage");

ALTER TABLE "AiKnowledgeChunk" ADD CONSTRAINT "AiKnowledgeChunk_knowledgeEntryId_fkey"
  FOREIGN KEY ("knowledgeEntryId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiKnowledgeReview" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "stage" "AiKnowledgeReviewStage" NOT NULL,
    "decision" "AiKnowledgeReviewDecision",
    "reviewerId" TEXT,
    "comments" TEXT,
    "checklistJson" JSONB,
    "queueSource" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    "importRunId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiKnowledgeReview_knowledgeEntryId_stage_idx" ON "AiKnowledgeReview"("knowledgeEntryId", "stage");
CREATE INDEX "AiKnowledgeReview_stage_completedAt_idx" ON "AiKnowledgeReview"("stage", "completedAt");

ALTER TABLE "AiKnowledgeReview" ADD CONSTRAINT "AiKnowledgeReview_knowledgeEntryId_fkey"
  FOREIGN KEY ("knowledgeEntryId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiKnowledgeApproval" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "approverVetId" TEXT NOT NULL,
    "vetLicenseNo" VARCHAR(64),
    "signOffHash" VARCHAR(128),
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "AiKnowledgeApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiKnowledgeApproval_knowledgeEntryId_approvedAt_idx" ON "AiKnowledgeApproval"("knowledgeEntryId", "approvedAt");
CREATE INDEX "AiKnowledgeApproval_approverVetId_idx" ON "AiKnowledgeApproval"("approverVetId");

ALTER TABLE "AiKnowledgeApproval" ADD CONSTRAINT "AiKnowledgeApproval_knowledgeEntryId_fkey"
  FOREIGN KEY ("knowledgeEntryId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
