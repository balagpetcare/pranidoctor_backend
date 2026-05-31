-- Phase 6B.1 — Veterinary Knowledge Foundation (VKF)

CREATE TYPE "VkKnowledgeDomain" AS ENUM (
  'DISEASE',
  'MEDICINE',
  'VACCINE',
  'FEED',
  'BREED',
  'REPRODUCTION',
  'EMERGENCY',
  'CLINICAL_PROTOCOL',
  'REGULATORY_BD',
  'FARM_MGMT'
);

CREATE TYPE "VkVersionStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'VET_APPROVAL',
  'CHANGES_REQUESTED',
  'PUBLISHED',
  'DEPRECATED',
  'REJECTED'
);

CREATE TYPE "VkReviewStage" AS ENUM (
  'EDITORIAL',
  'LANGUAGE_BN',
  'LANGUAGE_EN',
  'DOMAIN_LEAD',
  'VET'
);

CREATE TABLE "VkKnowledgeEntity" (
  "id" TEXT NOT NULL,
  "domain" "VkKnowledgeDomain" NOT NULL,
  "entityType" VARCHAR(64) NOT NULL,
  "slug" VARCHAR(128) NOT NULL,
  "currentPublishedVersionId" TEXT,
  "currentDraftVersionId" TEXT,
  "legacyEntryId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VkKnowledgeEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VkKnowledgeVersion" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "supersedesVersionId" TEXT,
  "status" "VkVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "titleBn" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "summaryBn" TEXT,
  "summaryEn" TEXT,
  "bodyBn" TEXT NOT NULL,
  "bodyEn" TEXT NOT NULL,
  "species" "LivestockSpecies"[],
  "audience" "AiKnowledgeAudience" NOT NULL DEFAULT 'FARMER',
  "regionScope" VARCHAR(16) NOT NULL DEFAULT 'BD',
  "structuredJson" JSONB,
  "keywordsBn" TEXT[],
  "keywordsEn" TEXT[],
  "colloquialBn" TEXT[],
  "searchText" TEXT,
  "chunkPolicyId" VARCHAR(64),
  "clinicalRiskTier" "AiKnowledgeClinicalRiskTier" NOT NULL DEFAULT 'LOW',
  "embeddingStatus" "AiKnowledgeEmbeddingStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "changeSummary" TEXT,
  "changedFields" TEXT[],
  "diffJson" JSONB,
  "aiGeneratedDraft" BOOLEAN NOT NULL DEFAULT false,
  "importRunId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "deprecationReason" TEXT,
  "createdById" TEXT,
  "publishedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VkKnowledgeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VkKnowledgeCitation" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "documentId" TEXT,
  "pageRef" VARCHAR(64),
  "sectionRef" VARCHAR(128),
  "tableRef" VARCHAR(64),
  "rowRef" VARCHAR(64),
  "spanRefsJson" JSONB,
  "contributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "quotedFrom" BOOLEAN NOT NULL DEFAULT false,
  "inlineCitationKey" VARCHAR(128) NOT NULL,
  "humanCitationBn" TEXT,
  "humanCitationEn" TEXT,
  "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VkKnowledgeCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VkKnowledgeReview" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "stage" "VkReviewStage" NOT NULL,
  "decision" "AiKnowledgeReviewDecision",
  "reviewerId" TEXT,
  "checklistJson" JSONB,
  "comments" TEXT,
  "queueSource" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  "importRunId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VkKnowledgeReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VkKnowledgeApproval" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "approverVetId" TEXT NOT NULL,
  "vetLicenseNo" VARCHAR(64),
  "approvalScope" TEXT[],
  "signOffHash" VARCHAR(128),
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "dualApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
  "coApproverVetId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VkKnowledgeApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VkKnowledgeAuditEvent" (
  "id" TEXT NOT NULL,
  "entityId" TEXT,
  "versionId" TEXT,
  "eventType" VARCHAR(64) NOT NULL,
  "actorId" TEXT,
  "actorRole" VARCHAR(32),
  "detailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VkKnowledgeAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VkKnowledgeEntity_slug_key" ON "VkKnowledgeEntity"("slug");
CREATE UNIQUE INDEX "VkKnowledgeEntity_currentPublishedVersionId_key" ON "VkKnowledgeEntity"("currentPublishedVersionId");
CREATE UNIQUE INDEX "VkKnowledgeEntity_currentDraftVersionId_key" ON "VkKnowledgeEntity"("currentDraftVersionId");
CREATE UNIQUE INDEX "VkKnowledgeEntity_legacyEntryId_key" ON "VkKnowledgeEntity"("legacyEntryId");
CREATE INDEX "VkKnowledgeEntity_domain_entityType_idx" ON "VkKnowledgeEntity"("domain", "entityType");

CREATE UNIQUE INDEX "VkKnowledgeVersion_entityId_versionNumber_key" ON "VkKnowledgeVersion"("entityId", "versionNumber");
CREATE INDEX "VkKnowledgeVersion_entityId_status_idx" ON "VkKnowledgeVersion"("entityId", "status");
CREATE INDEX "VkKnowledgeVersion_status_clinicalRiskTier_idx" ON "VkKnowledgeVersion"("status", "clinicalRiskTier");
CREATE INDEX "VkKnowledgeVersion_publishedAt_idx" ON "VkKnowledgeVersion"("publishedAt");

CREATE INDEX "VkKnowledgeCitation_versionId_idx" ON "VkKnowledgeCitation"("versionId");
CREATE INDEX "VkKnowledgeCitation_sourceId_idx" ON "VkKnowledgeCitation"("sourceId");

CREATE INDEX "VkKnowledgeReview_versionId_stage_idx" ON "VkKnowledgeReview"("versionId", "stage");
CREATE INDEX "VkKnowledgeReview_stage_completedAt_idx" ON "VkKnowledgeReview"("stage", "completedAt");

CREATE INDEX "VkKnowledgeApproval_versionId_approvedAt_idx" ON "VkKnowledgeApproval"("versionId", "approvedAt");
CREATE INDEX "VkKnowledgeApproval_approverVetId_idx" ON "VkKnowledgeApproval"("approverVetId");

CREATE INDEX "VkKnowledgeAuditEvent_entityId_createdAt_idx" ON "VkKnowledgeAuditEvent"("entityId", "createdAt");
CREATE INDEX "VkKnowledgeAuditEvent_versionId_createdAt_idx" ON "VkKnowledgeAuditEvent"("versionId", "createdAt");
CREATE INDEX "VkKnowledgeAuditEvent_eventType_createdAt_idx" ON "VkKnowledgeAuditEvent"("eventType", "createdAt");

ALTER TABLE "VkKnowledgeVersion" ADD CONSTRAINT "VkKnowledgeVersion_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "VkKnowledgeEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VkKnowledgeVersion" ADD CONSTRAINT "VkKnowledgeVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VkKnowledgeEntity" ADD CONSTRAINT "VkKnowledgeEntity_currentPublishedVersionId_fkey" FOREIGN KEY ("currentPublishedVersionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VkKnowledgeEntity" ADD CONSTRAINT "VkKnowledgeEntity_currentDraftVersionId_fkey" FOREIGN KEY ("currentDraftVersionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VkKnowledgeCitation" ADD CONSTRAINT "VkKnowledgeCitation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VkKnowledgeCitation" ADD CONSTRAINT "VkKnowledgeCitation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AiKnowledgeSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VkKnowledgeCitation" ADD CONSTRAINT "VkKnowledgeCitation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AiKnowledgeSourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VkKnowledgeReview" ADD CONSTRAINT "VkKnowledgeReview_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VkKnowledgeApproval" ADD CONSTRAINT "VkKnowledgeApproval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VkKnowledgeAuditEvent" ADD CONSTRAINT "VkKnowledgeAuditEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
