-- Phase 6B.2 — Knowledge Import Pipeline

CREATE TYPE "AiKnowledgeImportPipelineStage" AS ENUM (
  'QUEUED',
  'INTAKE',
  'EXTRACTING',
  'EXTRACT_COMPLETE',
  'VALIDATING',
  'NORMALIZING',
  'DEDUPING',
  'VERSIONING',
  'ROUTING',
  'COMPLETED'
);

CREATE TYPE "AiKnowledgeImportJobStage" AS ENUM (
  'IMPORT',
  'VALIDATE',
  'NORMALIZE',
  'DEDUP',
  'VERSION',
  'ROUTE'
);

CREATE TYPE "AiKnowledgeImportJobStatus" AS ENUM (
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'RETRY_SCHEDULED'
);

CREATE TYPE "AiKnowledgeValidationItemStatus" AS ENUM (
  'PENDING',
  'PASSED',
  'FAILED',
  'WAIVED'
);

ALTER TYPE "AiKnowledgeImportRunStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "AiKnowledgeImportRun"
  ADD COLUMN IF NOT EXISTS "profileKey" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "mode" VARCHAR(32) NOT NULL DEFAULT 'LIVE',
  ADD COLUMN IF NOT EXISTS "pipelineStage" "AiKnowledgeImportPipelineStage" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN IF NOT EXISTS "validationSummaryJson" JSONB;

ALTER TABLE "AiKnowledgeImportRun" ALTER COLUMN "pipelineVersion" SET DEFAULT '6b2.0';

CREATE TABLE "AiKnowledgeImportJob" (
  "id" TEXT NOT NULL,
  "importRunId" TEXT NOT NULL,
  "jobStage" "AiKnowledgeImportJobStage" NOT NULL,
  "status" "AiKnowledgeImportJobStatus" NOT NULL DEFAULT 'QUEUED',
  "payloadJson" JSONB NOT NULL,
  "resultJson" JSONB,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiKnowledgeImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiKnowledgeValidationItem" (
  "id" TEXT NOT NULL,
  "importRunId" TEXT NOT NULL,
  "extractIndex" INTEGER NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "status" "AiKnowledgeValidationItemStatus" NOT NULL DEFAULT 'PENDING',
  "failureCodes" TEXT[],
  "waivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiKnowledgeValidationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiKnowledgeQuarantineRecord" (
  "id" TEXT NOT NULL,
  "importRunId" TEXT NOT NULL,
  "extractIndex" INTEGER,
  "reasonCode" VARCHAR(64) NOT NULL,
  "message" TEXT,
  "rawSnapshotJson" JSONB,
  "resolution" VARCHAR(32),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiKnowledgeQuarantineRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiKnowledgeImportRun_pipelineStage_startedAt_idx" ON "AiKnowledgeImportRun"("pipelineStage", "startedAt");
CREATE INDEX "AiKnowledgeImportJob_importRunId_jobStage_idx" ON "AiKnowledgeImportJob"("importRunId", "jobStage");
CREATE INDEX "AiKnowledgeImportJob_status_scheduledAt_idx" ON "AiKnowledgeImportJob"("status", "scheduledAt");
CREATE INDEX "AiKnowledgeValidationItem_importRunId_status_idx" ON "AiKnowledgeValidationItem"("importRunId", "status");
CREATE INDEX "AiKnowledgeValidationItem_importRunId_extractIndex_idx" ON "AiKnowledgeValidationItem"("importRunId", "extractIndex");
CREATE INDEX "AiKnowledgeQuarantineRecord_importRunId_reasonCode_idx" ON "AiKnowledgeQuarantineRecord"("importRunId", "reasonCode");

ALTER TABLE "AiKnowledgeImportJob" ADD CONSTRAINT "AiKnowledgeImportJob_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "AiKnowledgeImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiKnowledgeValidationItem" ADD CONSTRAINT "AiKnowledgeValidationItem_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "AiKnowledgeImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiKnowledgeQuarantineRecord" ADD CONSTRAINT "AiKnowledgeQuarantineRecord_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "AiKnowledgeImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
