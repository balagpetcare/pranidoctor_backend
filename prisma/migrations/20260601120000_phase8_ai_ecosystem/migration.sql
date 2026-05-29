-- Phase 8 — AI & Smart Ecosystem

CREATE TYPE "AiKnowledgeContentType" AS ENUM ('DISEASE', 'MEDICINE', 'VACCINE', 'FEED', 'FARM_MGMT', 'EMERGENCY');
CREATE TYPE "AiKnowledgeAudience" AS ENUM ('FARMER', 'DOCTOR', 'BOTH');
CREATE TYPE "AiKnowledgeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'DEPRECATED');
CREATE TYPE "SmartRecommendationType" AS ENUM ('VACCINE', 'DEWORM', 'FEED', 'PREGNANCY', 'FARM', 'HEALTH', 'INVENTORY');
CREATE TYPE "SmartRecommendationStatus" AS ENUM ('PENDING', 'DISMISSED', 'COMPLETED', 'SNOOZED');
CREATE TYPE "AiPromptStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "AiAlertPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AiAlertStatus" AS ENUM ('PENDING', 'DELIVERED', 'DISMISSED', 'SNOOZED');

CREATE TABLE "AiKnowledgeEntry" (
    "id" TEXT NOT NULL,
    "contentType" "AiKnowledgeContentType" NOT NULL,
    "slug" TEXT NOT NULL,
    "audience" "AiKnowledgeAudience" NOT NULL DEFAULT 'FARMER',
    "titleBn" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyBn" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "species" "LivestockSpecies"[],
    "status" "AiKnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "reviewedById" TEXT,
    "metadataJson" JSONB,
    "searchText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiKnowledgeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSymptomNode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "species" "LivestockSpecies"[],
    "bodySystem" TEXT NOT NULL,
    "labelBn" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "redFlag" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiSymptomNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSymptomDiseaseLink" (
    "symptomNodeId" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "edgeWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    CONSTRAINT "AiSymptomDiseaseLink_pkey" PRIMARY KEY ("symptomNodeId","knowledgeEntryId")
);

CREATE TABLE "AiSymptomCheckSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "livestockId" TEXT,
    "species" "LivestockSpecies" NOT NULL,
    "symptomsJson" JSONB NOT NULL,
    "symptomCodes" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "redFlagsJson" JSONB NOT NULL,
    "differentialsJson" JSONB NOT NULL,
    "triageBucket" "AiRiskBucket" NOT NULL,
    "urgencyLevel" INTEGER NOT NULL,
    "aiSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiSymptomCheckSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartRecommendation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmRef" TEXT,
    "livestockId" TEXT,
    "type" "SmartRecommendationType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "titleBn" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "explanationBn" TEXT NOT NULL,
    "explanationEn" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL DEFAULT 'smart-v1',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "dueDate" DATE,
    "status" "SmartRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "deepLink" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmartRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DewormingRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "productName" TEXT,
    "administeredDate" DATE NOT NULL,
    "nextDueDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DewormingRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmRiskSnapshot" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmRef" TEXT NOT NULL,
    "herdHealthScore" INTEGER NOT NULL,
    "farmRiskScore" INTEGER NOT NULL,
    "mortalityRiskAvg" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "factorsJson" JSONB NOT NULL,
    CONSTRAINT "FarmRiskSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegionalOutbreakSignal" (
    "id" TEXT NOT NULL,
    "diseaseSlug" TEXT NOT NULL,
    "divisionId" TEXT,
    "districtId" TEXT,
    "riskIndex" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegionalOutbreakSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiUsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6),
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiPromptTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemBn" TEXT NOT NULL,
    "systemEn" TEXT NOT NULL,
    "userTemplateBn" TEXT,
    "userTemplateEn" TEXT,
    "status" "AiPromptStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiPromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSmartAlert" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "priority" "AiAlertPriority" NOT NULL DEFAULT 'MEDIUM',
    "titleBn" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyBn" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "deepLink" TEXT,
    "status" "AiAlertStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiSmartAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiFollowUpSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "livestockId" TEXT,
    "sessionId" TEXT,
    "triageId" TEXT,
    "titleBn" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "actionBn" TEXT NOT NULL,
    "actionEn" TEXT NOT NULL,
    "dueDate" DATE,
    "deepLink" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiFollowUpSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiKnowledgeEntry_slug_key" ON "AiKnowledgeEntry"("slug");
CREATE INDEX "AiKnowledgeEntry_contentType_status_idx" ON "AiKnowledgeEntry"("contentType", "status");
CREATE INDEX "AiKnowledgeEntry_status_idx" ON "AiKnowledgeEntry"("status");
CREATE UNIQUE INDEX "AiSymptomNode_code_key" ON "AiSymptomNode"("code");
CREATE INDEX "AiSymptomNode_bodySystem_idx" ON "AiSymptomNode"("bodySystem");
CREATE INDEX "AiSymptomCheckSession_userId_createdAt_idx" ON "AiSymptomCheckSession"("userId", "createdAt");
CREATE INDEX "AiSymptomCheckSession_customerId_idx" ON "AiSymptomCheckSession"("customerId");
CREATE INDEX "SmartRecommendation_customerId_status_dueDate_idx" ON "SmartRecommendation"("customerId", "status", "dueDate");
CREATE INDEX "SmartRecommendation_customerId_farmRef_idx" ON "SmartRecommendation"("customerId", "farmRef");
CREATE INDEX "DewormingRecord_livestockId_idx" ON "DewormingRecord"("livestockId");
CREATE INDEX "DewormingRecord_customerId_nextDueDate_idx" ON "DewormingRecord"("customerId", "nextDueDate");
CREATE INDEX "FarmRiskSnapshot_customerId_farmRef_computedAt_idx" ON "FarmRiskSnapshot"("customerId", "farmRef", "computedAt");
CREATE INDEX "RegionalOutbreakSignal_effectiveDate_idx" ON "RegionalOutbreakSignal"("effectiveDate");
CREATE INDEX "RegionalOutbreakSignal_diseaseSlug_idx" ON "RegionalOutbreakSignal"("diseaseSlug");
CREATE INDEX "AiUsageRecord_createdAt_feature_idx" ON "AiUsageRecord"("createdAt", "feature");
CREATE INDEX "AiUsageRecord_userId_idx" ON "AiUsageRecord"("userId");
CREATE UNIQUE INDEX "AiPromptTemplate_key_key" ON "AiPromptTemplate"("key");
CREATE INDEX "AiPromptTemplate_status_idx" ON "AiPromptTemplate"("status");
CREATE INDEX "AiSmartAlert_customerId_status_idx" ON "AiSmartAlert"("customerId", "status");
CREATE INDEX "AiSmartAlert_scheduledAt_idx" ON "AiSmartAlert"("scheduledAt");
CREATE INDEX "AiFollowUpSuggestion_userId_dismissed_idx" ON "AiFollowUpSuggestion"("userId", "dismissed");
CREATE INDEX "AiFollowUpSuggestion_customerId_idx" ON "AiFollowUpSuggestion"("customerId");

ALTER TABLE "AiSymptomDiseaseLink" ADD CONSTRAINT "AiSymptomDiseaseLink_symptomNodeId_fkey" FOREIGN KEY ("symptomNodeId") REFERENCES "AiSymptomNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSymptomDiseaseLink" ADD CONSTRAINT "AiSymptomDiseaseLink_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartRecommendation" ADD CONSTRAINT "SmartRecommendation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DewormingRecord" ADD CONSTRAINT "DewormingRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FarmRiskSnapshot" ADD CONSTRAINT "FarmRiskSnapshot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSmartAlert" ADD CONSTRAINT "AiSmartAlert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
