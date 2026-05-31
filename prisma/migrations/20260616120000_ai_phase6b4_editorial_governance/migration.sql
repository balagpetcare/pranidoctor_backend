-- Phase 6B.4 — Editorial Governance (change requests + conflict records)

CREATE TYPE "VkChangeRequestSeverity" AS ENUM ('MINOR', 'MAJOR', 'BLOCKING');
CREATE TYPE "VkChangeRequestStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');
CREATE TYPE "VkGovernanceConflictType" AS ENUM ('C1', 'C2', 'C3', 'C4', 'C5', 'C6');
CREATE TYPE "VkGovernanceConflictStatus" AS ENUM ('OPEN', 'ESCALATED', 'RESOLVED', 'OVERRIDDEN');

CREATE TABLE "VkKnowledgeChangeRequest" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "stage" "VkReviewStage" NOT NULL,
  "requestedById" TEXT NOT NULL,
  "summaryBn" TEXT,
  "summaryEn" TEXT,
  "severity" "VkChangeRequestSeverity" NOT NULL DEFAULT 'MINOR',
  "status" "VkChangeRequestStatus" NOT NULL DEFAULT 'OPEN',
  "checklistJson" JSONB NOT NULL,
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VkKnowledgeChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VkGovernanceConflict" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "conflictType" "VkGovernanceConflictType" NOT NULL,
  "status" "VkGovernanceConflictStatus" NOT NULL DEFAULT 'OPEN',
  "openedById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "detailJson" JSONB,
  "resolutionJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VkGovernanceConflict_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VkKnowledgeChangeRequest_versionId_status_idx" ON "VkKnowledgeChangeRequest"("versionId", "status");
CREATE INDEX "VkKnowledgeChangeRequest_requestedById_idx" ON "VkKnowledgeChangeRequest"("requestedById");

CREATE INDEX "VkGovernanceConflict_versionId_status_idx" ON "VkGovernanceConflict"("versionId", "status");
CREATE INDEX "VkGovernanceConflict_conflictType_status_idx" ON "VkGovernanceConflict"("conflictType", "status");

ALTER TABLE "VkKnowledgeChangeRequest"
  ADD CONSTRAINT "VkKnowledgeChangeRequest_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VkGovernanceConflict"
  ADD CONSTRAINT "VkGovernanceConflict_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
