-- Feed Intelligence Ecosystem Phase F1: VKL Feed Knowledge Extension
-- This migration adds:
-- 1. New enums for feed knowledge domain
-- 2. VKL feed ingredient, nutrient requirement, toxic alert tables
-- 3. Ration templates and seasonal calendars
-- 4. Feed formulation requests and AI Feed Advisor sessions
-- 5. Feed knowledge graph edges

-- CreateEnum
CREATE TYPE "BdFeedAvailability" AS ENUM (
    'WIDELY_AVAILABLE',
    'SEASONALLY_AVAILABLE',
    'REGIONAL_LIMITED',
    'IMPORT_DEPENDENT',
    'RARELY_AVAILABLE'
);

-- CreateEnum
CREATE TYPE "FeedPriceVolatility" AS ENUM (
    'STABLE',
    'MODERATE',
    'HIGH',
    'VERY_HIGH'
);

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM (
    'CALF_PRE_WEANING',
    'CALF_POST_WEANING',
    'GROWING',
    'FATTENING',
    'DRY_COW',
    'EARLY_LACTATION',
    'MID_LACTATION',
    'LATE_LACTATION',
    'MAINTENANCE',
    'BREEDING',
    'PREGNANT',
    'LATE_PREGNANT',
    'LAYING',
    'BROODING',
    'STARTER',
    'FINISHER'
);

-- CreateEnum
CREATE TYPE "BreedCategory" AS ENUM (
    'LOCAL_DESI',
    'CROSSBRED',
    'EXOTIC_PURE',
    'INDIGENOUS_IMPROVED'
);

-- CreateEnum
CREATE TYPE "FeedAdvisorSessionState" AS ENUM (
    'CREATED',
    'CONTEXT_GATHERING',
    'ANALYZING',
    'FORMULATING',
    'COMPLETE',
    'ESCALATED',
    'ABANDONED'
);

-- CreateEnum
CREATE TYPE "FormulationStatus" AS ENUM (
    'PENDING',
    'OPTIMIZING',
    'COMPLETED',
    'FAILED',
    'INFEASIBLE'
);

-- CreateEnum
CREATE TYPE "FeedKnowledgeEntityType" AS ENUM (
    'FEED_INGREDIENT',
    'NUTRIENT_REQUIREMENT',
    'RATION_TEMPLATE',
    'TOXIC_FEED_ALERT',
    'FEEDING_GUIDELINE',
    'SEASONAL_CALENDAR',
    'ANTINUTRIENT_LIMIT'
);

-- CreateTable: VK Feed Ingredient (VKL extension for feed ingredients)
CREATE TABLE "vk_feed_ingredients" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "ingredientCode" VARCHAR(64) NOT NULL,
    "localNamesBn" TEXT[],
    "localNamesEn" TEXT[],
    "dmPercent" DECIMAL(6,2) NOT NULL,
    "cpPercent" DECIMAL(6,2),
    "tdnPercent" DECIMAL(6,2),
    "ndfPercent" DECIMAL(6,2),
    "adfPercent" DECIMAL(6,2),
    "meValueMjPerKg" DECIMAL(8,3),
    "caPercent" DECIMAL(6,3),
    "pPercent" DECIMAL(6,3),
    "cfPercent" DECIMAL(6,2),
    "eePercent" DECIMAL(6,2),
    "ashPercent" DECIMAL(6,2),
    "bdAvailability" "BdFeedAvailability" NOT NULL DEFAULT 'WIDELY_AVAILABLE',
    "seasonalityJson" JSONB,
    "avgPriceBdtPerKg" DECIMAL(10,2),
    "priceVolatility" "FeedPriceVolatility" NOT NULL DEFAULT 'MODERATE',
    "lastPriceUpdateAt" TIMESTAMP(3),
    "speciesRestrictions" "LivestockSpecies"[],
    "antinutrientJson" JSONB,
    "maxInclusionJson" JSONB,
    "feedItemId" TEXT,
    "sourceAttributionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vk_feed_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VK Nutrient Requirement (VKL extension for nutrient requirements)
CREATE TABLE "vk_nutrient_requirements" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "species" "LivestockSpecies" NOT NULL,
    "breedCategory" "BreedCategory",
    "productionStage" "ProductionStage" NOT NULL,
    "weightRangeMinKg" DECIMAL(8,2),
    "weightRangeMaxKg" DECIMAL(8,2),
    "dmIntakeKgPerDay" DECIMAL(6,2),
    "dmIntakePercentBw" DECIMAL(5,2),
    "cpPercentMin" DECIMAL(6,2),
    "cpPercentMax" DECIMAL(6,2),
    "tdnPercentMin" DECIMAL(6,2),
    "meMinMjPerKg" DECIMAL(6,2),
    "ndfPercentMax" DECIMAL(6,2),
    "caPercentMin" DECIMAL(6,3),
    "pPercentMin" DECIMAL(6,3),
    "milkYieldLiters" DECIMAL(6,2),
    "adgKg" DECIMAL(6,3),
    "sourceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vk_nutrient_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VK Toxic Feed Alert (VKL extension for toxic feed alerts)
CREATE TABLE "vk_toxic_feed_alerts" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "substance" VARCHAR(128) NOT NULL,
    "commonNamesBn" TEXT[],
    "commonNamesEn" TEXT[],
    "speciesAffected" "LivestockSpecies"[],
    "toxicThreshold" VARCHAR(128) NOT NULL,
    "lethalThreshold" VARCHAR(128),
    "clinicalSignsBn" TEXT[],
    "clinicalSignsEn" TEXT[],
    "onsetTime" VARCHAR(64),
    "immediateActionBn" TEXT NOT NULL,
    "immediateActionEn" TEXT NOT NULL,
    "vetRequired" BOOLEAN NOT NULL DEFAULT true,
    "relatedIngredientCodes" TEXT[],
    "sourceAttributionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vk_toxic_feed_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VK Ration Template (VKL extension for ration templates)
CREATE TABLE "vk_ration_templates" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "templateCode" VARCHAR(64) NOT NULL,
    "templateNameBn" TEXT NOT NULL,
    "templateNameEn" TEXT NOT NULL,
    "species" "LivestockSpecies" NOT NULL,
    "productionStage" "ProductionStage" NOT NULL,
    "targetProduction" VARCHAR(128),
    "ingredientsJson" JSONB NOT NULL,
    "concentrateRatio" DECIMAL(5,2),
    "roughageRatio" DECIMAL(5,2),
    "calculatedCpPercent" DECIMAL(6,2),
    "calculatedTdnPercent" DECIMAL(6,2),
    "calculatedMeMjPerKg" DECIMAL(6,2),
    "estimatedCostBdtPerKg" DECIMAL(10,2),
    "suitabilityNotesBn" TEXT,
    "suitabilityNotesEn" TEXT,
    "sourceAttributionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vk_ration_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VK Seasonal Feed Calendar (VKL extension for seasonal data)
CREATE TABLE "vk_seasonal_feed_calendars" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "regionCode" VARCHAR(16) NOT NULL DEFAULT 'BD',
    "availableIngredientCodes" TEXT[],
    "peakIngredientCodes" TEXT[],
    "scarcityIngredientCodes" TEXT[],
    "priceIndexJson" JSONB,
    "guidelinesBn" TEXT,
    "guidelinesEn" TEXT,
    "sourceAttributionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vk_seasonal_feed_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Feed Formulation Request (operational)
CREATE TABLE "feed_formulation_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "livestockId" TEXT,
    "species" "LivestockSpecies" NOT NULL,
    "productionStage" "ProductionStage" NOT NULL,
    "breedCategory" "BreedCategory",
    "weightKg" DECIMAL(8,2),
    "targetOutput" VARCHAR(128),
    "availableIngredients" TEXT[],
    "budgetBdtPerDay" DECIMAL(10,2),
    "excludeIngredients" TEXT[],
    "formulationJson" JSONB,
    "totalCostBdtPerDay" DECIMAL(10,2),
    "nutritionalMatchScore" DECIMAL(5,2),
    "packId" TEXT,
    "citationsJson" JSONB,
    "confidenceScore" DECIMAL(5,4),
    "status" "FormulationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_formulation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AI Feed Advisor Session
CREATE TABLE "ai_feed_advisor_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sessionId" TEXT,
    "species" "LivestockSpecies" NOT NULL,
    "productionStage" "ProductionStage",
    "breedCategory" "BreedCategory",
    "livestockId" TEXT,
    "breedSlug" VARCHAR(64),
    "state" "FeedAdvisorSessionState" NOT NULL DEFAULT 'CREATED',
    "locale" VARCHAR(8) NOT NULL DEFAULT 'bn',
    "contextJson" JSONB,
    "queryHistory" JSONB,
    "ingredientCodesQueried" TEXT[],
    "confidenceScore" DECIMAL(5,4),
    "packId" TEXT,
    "toxicAlertTriggered" BOOLEAN NOT NULL DEFAULT false,
    "escalationIds" TEXT[],
    "formRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_feed_advisor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VK Feed Knowledge Graph Edge
CREATE TABLE "vk_feed_knowledge_graph_edges" (
    "id" TEXT NOT NULL,
    "edgeType" VARCHAR(64) NOT NULL,
    "fromEntitySlug" VARCHAR(128) NOT NULL,
    "toEntitySlug" VARCHAR(128) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "labelBn" TEXT,
    "labelEn" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vk_feed_knowledge_graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vk_feed_ingredients_ingredientCode_key" ON "vk_feed_ingredients"("ingredientCode");
CREATE UNIQUE INDEX "vk_feed_ingredients_feedItemId_key" ON "vk_feed_ingredients"("feedItemId");
CREATE INDEX "vk_feed_ingredients_bdAvailability_idx" ON "vk_feed_ingredients"("bdAvailability");
CREATE INDEX "vk_feed_ingredients_versionId_idx" ON "vk_feed_ingredients"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "vk_nutrient_requirements_species_productionStage_breedCateg_key" ON "vk_nutrient_requirements"("species", "productionStage", "breedCategory");
CREATE INDEX "vk_nutrient_requirements_versionId_idx" ON "vk_nutrient_requirements"("versionId");
CREATE INDEX "vk_nutrient_requirements_species_productionStage_idx" ON "vk_nutrient_requirements"("species", "productionStage");

-- CreateIndex
CREATE INDEX "vk_toxic_feed_alerts_substance_idx" ON "vk_toxic_feed_alerts"("substance");
CREATE INDEX "vk_toxic_feed_alerts_versionId_idx" ON "vk_toxic_feed_alerts"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "vk_ration_templates_templateCode_key" ON "vk_ration_templates"("templateCode");
CREATE INDEX "vk_ration_templates_species_productionStage_idx" ON "vk_ration_templates"("species", "productionStage");
CREATE INDEX "vk_ration_templates_versionId_idx" ON "vk_ration_templates"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "vk_seasonal_feed_calendars_month_regionCode_versionId_key" ON "vk_seasonal_feed_calendars"("month", "regionCode", "versionId");
CREATE INDEX "vk_seasonal_feed_calendars_versionId_idx" ON "vk_seasonal_feed_calendars"("versionId");

-- CreateIndex
CREATE INDEX "feed_formulation_requests_customerId_createdAt_idx" ON "feed_formulation_requests"("customerId", "createdAt");
CREATE INDEX "feed_formulation_requests_status_idx" ON "feed_formulation_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_feed_advisor_sessions_sessionId_key" ON "ai_feed_advisor_sessions"("sessionId");
CREATE UNIQUE INDEX "ai_feed_advisor_sessions_formRequestId_key" ON "ai_feed_advisor_sessions"("formRequestId");
CREATE INDEX "ai_feed_advisor_sessions_customerId_createdAt_idx" ON "ai_feed_advisor_sessions"("customerId", "createdAt");
CREATE INDEX "ai_feed_advisor_sessions_userId_createdAt_idx" ON "ai_feed_advisor_sessions"("userId", "createdAt");
CREATE INDEX "ai_feed_advisor_sessions_state_idx" ON "ai_feed_advisor_sessions"("state");

-- CreateIndex
CREATE UNIQUE INDEX "vk_feed_knowledge_graph_edges_edgeType_fromEntitySlug_toEnt_key" ON "vk_feed_knowledge_graph_edges"("edgeType", "fromEntitySlug", "toEntitySlug");
CREATE INDEX "vk_feed_knowledge_graph_edges_edgeType_idx" ON "vk_feed_knowledge_graph_edges"("edgeType");
CREATE INDEX "vk_feed_knowledge_graph_edges_fromEntitySlug_idx" ON "vk_feed_knowledge_graph_edges"("fromEntitySlug");
CREATE INDEX "vk_feed_knowledge_graph_edges_toEntitySlug_idx" ON "vk_feed_knowledge_graph_edges"("toEntitySlug");

-- AddForeignKey
ALTER TABLE "vk_feed_ingredients" ADD CONSTRAINT "vk_feed_ingredients_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vk_feed_ingredients" ADD CONSTRAINT "vk_feed_ingredients_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vk_nutrient_requirements" ADD CONSTRAINT "vk_nutrient_requirements_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vk_toxic_feed_alerts" ADD CONSTRAINT "vk_toxic_feed_alerts_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vk_ration_templates" ADD CONSTRAINT "vk_ration_templates_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vk_seasonal_feed_calendars" ADD CONSTRAINT "vk_seasonal_feed_calendars_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_formulation_requests" ADD CONSTRAINT "feed_formulation_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_formulation_requests" ADD CONSTRAINT "feed_formulation_requests_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feed_advisor_sessions" ADD CONSTRAINT "ai_feed_advisor_sessions_formRequestId_fkey" FOREIGN KEY ("formRequestId") REFERENCES "feed_formulation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_feed_advisor_sessions" ADD CONSTRAINT "ai_feed_advisor_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
