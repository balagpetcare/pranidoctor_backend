-- Phase 6B.3 — Chunking & Citation Engine (CCE)

CREATE TYPE "VkEvidenceAssessmentMethod" AS ENUM (
  'INGEST_HEURISTIC',
  'EDITORIAL_REVIEW',
  'VET_REVIEW',
  'SYSTEMATIC_REVIEW'
);

CREATE TYPE "VkConfidenceComputedBy" AS ENUM (
  'INGEST_PIPELINE',
  'REVIEW_WORKFLOW',
  'PUBLISH_JOB',
  'ADMIN_RECOMPUTE'
);

ALTER TABLE "VkKnowledgeCitation" ADD COLUMN "chunkId" TEXT;

CREATE TABLE "VkKnowledgeChunk" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "chunkPolicyId" VARCHAR(64) NOT NULL,
  "stage" "AiKnowledgeChunkStage" NOT NULL DEFAULT 'STAGING',
  "contentBn" TEXT NOT NULL,
  "contentEn" TEXT NOT NULL,
  "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "headingPath" VARCHAR(256),
  "structuredOverlay" JSONB,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VkKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VkKnowledgeEvidence" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "evidenceLevel" "AiKnowledgeEvidenceLevel" NOT NULL,
  "assessmentMethod" "VkEvidenceAssessmentMethod" NOT NULL,
  "rationaleBn" TEXT,
  "rationaleEn" TEXT,
  "assessorId" TEXT,
  "provisional" BOOLEAN NOT NULL DEFAULT true,
  "supersedesEvidenceId" TEXT,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VkKnowledgeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VkKnowledgeConfidence" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "formulaVersion" VARCHAR(16) NOT NULL DEFAULT 'v2',
  "componentsJson" JSONB NOT NULL,
  "provisional" BOOLEAN NOT NULL DEFAULT true,
  "computedBy" "VkConfidenceComputedBy" NOT NULL,
  "meetsProfileGatesJson" JSONB,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VkKnowledgeConfidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VkKnowledgeChunk_versionId_chunkIndex_stage_key"
  ON "VkKnowledgeChunk"("versionId", "chunkIndex", "stage");

CREATE INDEX "VkKnowledgeChunk_versionId_stage_idx"
  ON "VkKnowledgeChunk"("versionId", "stage");

CREATE INDEX "VkKnowledgeEvidence_versionId_assessedAt_idx"
  ON "VkKnowledgeEvidence"("versionId", "assessedAt");

CREATE INDEX "VkKnowledgeConfidence_versionId_computedAt_idx"
  ON "VkKnowledgeConfidence"("versionId", "computedAt");

CREATE INDEX "VkKnowledgeCitation_chunkId_idx"
  ON "VkKnowledgeCitation"("chunkId");

ALTER TABLE "VkKnowledgeCitation"
  ADD CONSTRAINT "VkKnowledgeCitation_chunkId_fkey"
  FOREIGN KEY ("chunkId") REFERENCES "VkKnowledgeChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VkKnowledgeChunk"
  ADD CONSTRAINT "VkKnowledgeChunk_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VkKnowledgeEvidence"
  ADD CONSTRAINT "VkKnowledgeEvidence_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VkKnowledgeConfidence"
  ADD CONSTRAINT "VkKnowledgeConfidence_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
