-- UVKG Phase 1–3: Unified Veterinary Knowledge Graph foundation
-- Planning: docs/plans/unified-veterinary-knowledge-graph.md

CREATE TYPE "VkKnowledgeLinkStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'VET_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED',
    'PUBLISHED',
    'ARCHIVED',
    'DEPRECATED',
    'REJECTED'
);

CREATE TYPE "VkKnowledgeEdgeClass" AS ENUM (
    'CLINICAL',
    'NUTRITIONAL',
    'REGULATORY',
    'COMMERCIAL',
    'METADATA'
);

CREATE TYPE "VkKnowledgeLinkDirection" AS ENUM (
    'DIRECTED',
    'UNDIRECTED'
);

CREATE TYPE "VkKnowledgeLinkSourceSystem" AS ENUM (
    'FEED_GRAPH',
    'MEDICINE_GRAPH',
    'DISEASE_GRAPH',
    'EDITORIAL',
    'IMPORT',
    'LEGACY_SYMPTOM'
);

CREATE TYPE "VkKnowledgeNodeRefType" AS ENUM (
    'DISEASE',
    'SYMPTOM',
    'MEDICINE_GENERIC',
    'MEDICINE_BRAND',
    'FEED_INGREDIENT',
    'FEED_FORMULA',
    'NUTRIENT',
    'SPECIES',
    'BREED',
    'VACCINE',
    'CONDITION',
    'RISK_FACTOR',
    'OUTBREAK',
    'REGION',
    'KNOWLEDGE_ENTITY',
    'PROTOCOL',
    'EMERGENCY',
    'OTHER'
);

CREATE TYPE "UvkgSyncConflictStatus" AS ENUM (
    'OPEN',
    'AUTO_RESOLVED',
    'MANUAL_REQUIRED'
);

CREATE TABLE "vk_knowledge_links" (
    "id" TEXT NOT NULL,
    "linkKey" VARCHAR(128) NOT NULL,
    "edgeType" VARCHAR(64) NOT NULL,
    "edgeClass" "VkKnowledgeEdgeClass" NOT NULL DEFAULT 'CLINICAL',
    "fromEntityId" TEXT,
    "fromRefType" "VkKnowledgeNodeRefType" NOT NULL,
    "fromRefId" VARCHAR(128) NOT NULL,
    "toEntityId" TEXT,
    "toRefType" "VkKnowledgeNodeRefType" NOT NULL,
    "toRefId" VARCHAR(128) NOT NULL,
    "direction" "VkKnowledgeLinkDirection" NOT NULL DEFAULT 'DIRECTED',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lineOrder" INTEGER,
    "species" "LivestockSpecies"[],
    "regionScope" TEXT[] DEFAULT ARRAY['BD']::TEXT[],
    "evidenceLevel" VARCHAR(8) NOT NULL DEFAULT 'L2',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "clinicalRiskTier" "AiKnowledgeClinicalRiskTier" NOT NULL DEFAULT 'LOW',
    "status" "VkKnowledgeLinkStatus" NOT NULL DEFAULT 'DRAFT',
    "vkVersionId" TEXT,
    "sourceEdgeId" VARCHAR(64),
    "sourceSystem" "VkKnowledgeLinkSourceSystem" NOT NULL,
    "labelBn" TEXT,
    "labelEn" TEXT,
    "metadataJson" JSONB,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deprecatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vk_knowledge_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vk_knowledge_links_staging" (
    "id" TEXT NOT NULL,
    "linkKey" VARCHAR(128) NOT NULL,
    "edgeType" VARCHAR(64) NOT NULL,
    "edgeClass" "VkKnowledgeEdgeClass" NOT NULL DEFAULT 'CLINICAL',
    "fromEntityId" TEXT,
    "fromRefType" "VkKnowledgeNodeRefType" NOT NULL,
    "fromRefId" VARCHAR(128) NOT NULL,
    "toEntityId" TEXT,
    "toRefType" "VkKnowledgeNodeRefType" NOT NULL,
    "toRefId" VARCHAR(128) NOT NULL,
    "direction" "VkKnowledgeLinkDirection" NOT NULL DEFAULT 'DIRECTED',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lineOrder" INTEGER,
    "species" "LivestockSpecies"[],
    "regionScope" TEXT[] DEFAULT ARRAY['BD']::TEXT[],
    "evidenceLevel" VARCHAR(8) NOT NULL DEFAULT 'L2',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "clinicalRiskTier" "AiKnowledgeClinicalRiskTier" NOT NULL DEFAULT 'LOW',
    "status" "VkKnowledgeLinkStatus" NOT NULL DEFAULT 'DRAFT',
    "vkVersionId" TEXT,
    "sourceEdgeId" VARCHAR(64),
    "sourceSystem" "VkKnowledgeLinkSourceSystem" NOT NULL,
    "labelBn" TEXT,
    "labelEn" TEXT,
    "metadataJson" JSONB,
    "rebuildBatchId" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vk_knowledge_links_staging_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vk_knowledge_link_reviews" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "stage" "VkReviewStage" NOT NULL,
    "outcome" VARCHAR(32) NOT NULL,
    "notes" TEXT,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vk_knowledge_link_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vk_knowledge_link_approvals" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "vetId" TEXT,
    "signOffHash" VARCHAR(128),
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vk_knowledge_link_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vk_knowledge_link_audit_events" (
    "id" TEXT NOT NULL,
    "linkId" TEXT,
    "eventType" VARCHAR(64) NOT NULL,
    "actorId" TEXT,
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vk_knowledge_link_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uvkg_sync_conflicts" (
    "id" TEXT NOT NULL,
    "linkKey" VARCHAR(128) NOT NULL,
    "sourceSystem" "VkKnowledgeLinkSourceSystem" NOT NULL,
    "sourceEdgeId" VARCHAR(64),
    "conflictType" VARCHAR(64) NOT NULL,
    "legacySnapshot" JSONB NOT NULL,
    "uvkgSnapshot" JSONB,
    "status" "UvkgSyncConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uvkg_sync_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vk_knowledge_links_linkKey_key" ON "vk_knowledge_links"("linkKey");
CREATE INDEX "vk_knowledge_links_edgeType_status_idx" ON "vk_knowledge_links"("edgeType", "status");
CREATE INDEX "vk_knowledge_links_fromRefType_fromRefId_idx" ON "vk_knowledge_links"("fromRefType", "fromRefId");
CREATE INDEX "vk_knowledge_links_toRefType_toRefId_idx" ON "vk_knowledge_links"("toRefType", "toRefId");
CREATE INDEX "vk_knowledge_links_sourceSystem_sourceEdgeId_idx" ON "vk_knowledge_links"("sourceSystem", "sourceEdgeId");
CREATE INDEX "vk_knowledge_links_status_edgeClass_idx" ON "vk_knowledge_links"("status", "edgeClass");

CREATE UNIQUE INDEX "vk_knowledge_links_staging_rebuildBatchId_linkKey_key" ON "vk_knowledge_links_staging"("rebuildBatchId", "linkKey");
CREATE INDEX "vk_knowledge_links_staging_rebuildBatchId_idx" ON "vk_knowledge_links_staging"("rebuildBatchId");

CREATE INDEX "vk_knowledge_link_reviews_linkId_createdAt_idx" ON "vk_knowledge_link_reviews"("linkId", "createdAt");
CREATE INDEX "vk_knowledge_link_approvals_linkId_createdAt_idx" ON "vk_knowledge_link_approvals"("linkId", "createdAt");
CREATE INDEX "vk_knowledge_link_audit_events_linkId_createdAt_idx" ON "vk_knowledge_link_audit_events"("linkId", "createdAt");
CREATE INDEX "vk_knowledge_link_audit_events_eventType_createdAt_idx" ON "vk_knowledge_link_audit_events"("eventType", "createdAt");

CREATE INDEX "uvkg_sync_conflicts_status_createdAt_idx" ON "uvkg_sync_conflicts"("status", "createdAt");
CREATE INDEX "uvkg_sync_conflicts_linkKey_idx" ON "uvkg_sync_conflicts"("linkKey");

ALTER TABLE "vk_knowledge_links" ADD CONSTRAINT "vk_knowledge_links_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "VkKnowledgeEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vk_knowledge_links" ADD CONSTRAINT "vk_knowledge_links_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "VkKnowledgeEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vk_knowledge_links" ADD CONSTRAINT "vk_knowledge_links_vkVersionId_fkey" FOREIGN KEY ("vkVersionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vk_knowledge_link_reviews" ADD CONSTRAINT "vk_knowledge_link_reviews_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "vk_knowledge_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vk_knowledge_link_approvals" ADD CONSTRAINT "vk_knowledge_link_approvals_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "vk_knowledge_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vk_knowledge_link_audit_events" ADD CONSTRAINT "vk_knowledge_link_audit_events_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "vk_knowledge_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
