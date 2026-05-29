-- Phase 4: Livestock Feed Ecosystem

CREATE TYPE "LivestockSpecies" AS ENUM ('COW', 'GOAT', 'SHEEP', 'CHICKEN', 'DUCK', 'PIGEON', 'BUFFALO', 'HORSE', 'CUSTOM', 'OTHER');
CREATE TYPE "LivestockGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN', 'OTHER');
CREATE TYPE "LivestockLifecycleStatus" AS ENUM ('ACTIVE', 'SOLD', 'DECEASED', 'MISSING', 'TRANSFERRED', 'INACTIVE');
CREATE TYPE "LivestockPurpose" AS ENUM ('DAIRY', 'MEAT', 'BREEDING', 'DRAFT', 'PET', 'MIXED', 'OTHER');
CREATE TYPE "LivestockHealthStatus" AS ENUM ('HEALTHY', 'SICK', 'RECOVERING', 'UNDER_OBSERVATION', 'UNKNOWN');
CREATE TYPE "FeedMoistureType" AS ENUM ('DRY', 'WET', 'FRESH');
CREATE TYPE "LivestockHealthRecordType" AS ENUM ('SYMPTOM', 'DIAGNOSIS', 'DISEASE', 'CHECKUP', 'TREATMENT', 'NOTE');
CREATE TYPE "LivestockVaccinationStatus" AS ENUM ('SCHEDULED', 'DUE', 'OVERDUE', 'COMPLETED', 'SKIPPED');
CREATE TYPE "FeedVendorVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "LivestockAuditAction" AS ENUM ('LIVESTOCK_CREATED', 'LIVESTOCK_UPDATED', 'LIVESTOCK_DELETED', 'HEALTH_RECORD_CREATED', 'VACCINATION_CREATED', 'FEED_INVENTORY_UPDATED', 'FEED_CONSUMPTION_CREATED', 'EXPENSE_CREATED');

CREATE TABLE "Livestock" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmRef" TEXT NOT NULL,
    "deploymentBranch" TEXT,
    "legacyAnimalProfileId" TEXT,
    "name" TEXT NOT NULL,
    "species" "LivestockSpecies" NOT NULL,
    "customSpeciesLabel" TEXT,
    "breedId" TEXT,
    "breedName" TEXT,
    "gender" "LivestockGender" NOT NULL,
    "purpose" "LivestockPurpose" DEFAULT 'MIXED',
    "lifecycleStatus" "LivestockLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "healthStatus" "LivestockHealthStatus" NOT NULL DEFAULT 'HEALTHY',
    "dateOfBirth" DATE,
    "weightKg" DECIMAL(10,3),
    "lastWeightAt" TIMESTAMP(3),
    "earTagNumber" TEXT,
    "qrCodePayload" TEXT,
    "pregnancyStatus" "PregnancyStatus",
    "lactationNumber" INTEGER,
    "lastCalvingDate" DATE,
    "photoUrl" TEXT,
    "purchaseDate" DATE,
    "purchasePriceBdt" DECIMAL(12,2),
    "saleDate" DATE,
    "salePriceBdt" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Livestock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivestockImage" (
    "id" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedFileId" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LivestockImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivestockHealthRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "farmRef" TEXT,
    "recordType" "LivestockHealthRecordType" NOT NULL,
    "title" TEXT NOT NULL,
    "symptoms" TEXT,
    "diagnosis" TEXT,
    "diseaseName" TEXT,
    "treatmentRef" TEXT,
    "notes" TEXT,
    "recordedDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LivestockHealthRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivestockVaccination" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "farmRef" TEXT,
    "vaccineName" TEXT NOT NULL,
    "vaccineType" TEXT,
    "scheduledDate" DATE NOT NULL,
    "administeredDate" DATE,
    "nextDueDate" DATE,
    "status" "LivestockVaccinationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "batchNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LivestockVaccination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "FeedCategory" NOT NULL,
    "nameBn" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "defaultUnit" "FeedUnit" NOT NULL,
    "approxPriceBdt" DECIMAL(12,2),
    "moistureType" "FeedMoistureType" NOT NULL DEFAULT 'DRY',
    "isSeasonal" BOOLEAN NOT NULL DEFAULT false,
    "seasonNotesBn" TEXT,
    "seasonNotesEn" TEXT,
    "restrictionJson" JSONB,
    "suitabilityJson" JSONB,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedNutrition" (
    "id" TEXT NOT NULL,
    "feedItemId" TEXT NOT NULL,
    "cpPercent" DECIMAL(6,2),
    "tdnPercent" DECIMAL(6,2),
    "cfPercent" DECIMAL(6,2),
    "eePercent" DECIMAL(6,2),
    "caPercent" DECIMAL(6,2),
    "pPercent" DECIMAL(6,2),
    "dmPercent" DECIMAL(6,2),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedNutrition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedInventory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmRef" TEXT NOT NULL,
    "deploymentBranch" TEXT,
    "feedItemId" TEXT,
    "displayName" TEXT NOT NULL,
    "unit" "FeedUnit" NOT NULL DEFAULT 'KG',
    "quantityOnHand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "lowStockThreshold" DECIMAL(12,3),
    "defaultBagWeightKg" DECIMAL(10,3),
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedInventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedPurchase" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmRef" TEXT NOT NULL,
    "feedInventoryId" TEXT NOT NULL,
    "feedItemId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "FeedUnit" NOT NULL,
    "unitCostBdt" DECIMAL(12,2),
    "totalCostBdt" DECIMAL(12,2),
    "supplierName" TEXT,
    "supplierPhone" TEXT,
    "purchasedAt" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedConsumption" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmRef" TEXT NOT NULL,
    "livestockId" TEXT,
    "feedInventoryId" TEXT,
    "feedItemId" TEXT,
    "amount" DECIMAL(12,3) NOT NULL,
    "unit" "FeedUnit" NOT NULL,
    "costBdt" DECIMAL(12,2),
    "deductStock" BOOLEAN NOT NULL DEFAULT false,
    "recordedDate" DATE NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedConsumption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "phone" TEXT,
    "districtId" TEXT,
    "address" TEXT,
    "verificationStatus" "FeedVendorVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedVendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedVendorProduct" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "feedItemId" TEXT,
    "displayName" TEXT NOT NULL,
    "unit" "FeedUnit" NOT NULL,
    "unitWeightKg" DECIMAL(10,3),
    "priceBdt" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedVendorProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedRecommendationLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "livestockId" TEXT NOT NULL,
    "planDate" DATE NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "totalsJson" JSONB NOT NULL,
    "warningsJson" JSONB,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedRecommendationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivestockExpense" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "livestockId" TEXT,
    "farmRef" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amountBdt" DECIMAL(12,2) NOT NULL,
    "recordedDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LivestockExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedAnalyticsCache" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmRef" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedAnalyticsCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivestockAuditLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "action" "LivestockAuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actorUserId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LivestockAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Livestock_legacyAnimalProfileId_key" ON "Livestock"("legacyAnimalProfileId");
CREATE UNIQUE INDEX "Livestock_customerId_earTagNumber_key" ON "Livestock"("customerId", "earTagNumber");
CREATE INDEX "Livestock_customerId_farmRef_lifecycleStatus_idx" ON "Livestock"("customerId", "farmRef", "lifecycleStatus");
CREATE INDEX "Livestock_customerId_species_idx" ON "Livestock"("customerId", "species");
CREATE INDEX "Livestock_customerId_updatedAt_idx" ON "Livestock"("customerId", "updatedAt");
CREATE INDEX "Livestock_deploymentBranch_idx" ON "Livestock"("deploymentBranch");
CREATE INDEX "Livestock_deletedAt_idx" ON "Livestock"("deletedAt");

CREATE INDEX "LivestockImage_livestockId_sortOrder_idx" ON "LivestockImage"("livestockId", "sortOrder");

CREATE INDEX "LivestockHealthRecord_customerId_recordedDate_idx" ON "LivestockHealthRecord"("customerId", "recordedDate");
CREATE INDEX "LivestockHealthRecord_livestockId_recordedDate_idx" ON "LivestockHealthRecord"("livestockId", "recordedDate");
CREATE INDEX "LivestockHealthRecord_recordType_idx" ON "LivestockHealthRecord"("recordType");

CREATE INDEX "LivestockVaccination_customerId_scheduledDate_idx" ON "LivestockVaccination"("customerId", "scheduledDate");
CREATE INDEX "LivestockVaccination_customerId_status_idx" ON "LivestockVaccination"("customerId", "status");
CREATE INDEX "LivestockVaccination_livestockId_idx" ON "LivestockVaccination"("livestockId");

CREATE UNIQUE INDEX "FeedItem_code_key" ON "FeedItem"("code");
CREATE INDEX "FeedItem_category_isActive_idx" ON "FeedItem"("category", "isActive");
CREATE INDEX "FeedItem_isActive_sortOrder_idx" ON "FeedItem"("isActive", "sortOrder");

CREATE UNIQUE INDEX "FeedNutrition_feedItemId_key" ON "FeedNutrition"("feedItemId");

CREATE UNIQUE INDEX "FeedInventory_customerId_farmRef_displayName_key" ON "FeedInventory"("customerId", "farmRef", "displayName");
CREATE INDEX "FeedInventory_customerId_farmRef_isActive_idx" ON "FeedInventory"("customerId", "farmRef", "isActive");
CREATE INDEX "FeedInventory_feedItemId_idx" ON "FeedInventory"("feedItemId");
CREATE INDEX "FeedInventory_deploymentBranch_idx" ON "FeedInventory"("deploymentBranch");

CREATE INDEX "FeedPurchase_customerId_farmRef_purchasedAt_idx" ON "FeedPurchase"("customerId", "farmRef", "purchasedAt");
CREATE INDEX "FeedPurchase_feedInventoryId_idx" ON "FeedPurchase"("feedInventoryId");

CREATE UNIQUE INDEX "FeedConsumption_customerId_idempotencyKey_key" ON "FeedConsumption"("customerId", "idempotencyKey");
CREATE INDEX "FeedConsumption_customerId_recordedDate_idx" ON "FeedConsumption"("customerId", "recordedDate");
CREATE INDEX "FeedConsumption_livestockId_idx" ON "FeedConsumption"("livestockId");
CREATE INDEX "FeedConsumption_feedInventoryId_idx" ON "FeedConsumption"("feedInventoryId");
CREATE INDEX "FeedConsumption_feedItemId_idx" ON "FeedConsumption"("feedItemId");

CREATE INDEX "FeedVendor_verificationStatus_isActive_idx" ON "FeedVendor"("verificationStatus", "isActive");
CREATE INDEX "FeedVendor_districtId_idx" ON "FeedVendor"("districtId");

CREATE INDEX "FeedVendorProduct_vendorId_isActive_idx" ON "FeedVendorProduct"("vendorId", "isActive");
CREATE INDEX "FeedVendorProduct_feedItemId_idx" ON "FeedVendorProduct"("feedItemId");

CREATE INDEX "FeedRecommendationLog_livestockId_planDate_idx" ON "FeedRecommendationLog"("livestockId", "planDate");
CREATE INDEX "FeedRecommendationLog_customerId_planDate_idx" ON "FeedRecommendationLog"("customerId", "planDate");

CREATE INDEX "LivestockExpense_customerId_recordedDate_idx" ON "LivestockExpense"("customerId", "recordedDate");
CREATE INDEX "LivestockExpense_livestockId_idx" ON "LivestockExpense"("livestockId");
CREATE INDEX "LivestockExpense_category_idx" ON "LivestockExpense"("category");

CREATE UNIQUE INDEX "FeedAnalyticsCache_customerId_farmRef_cacheKey_key" ON "FeedAnalyticsCache"("customerId", "farmRef", "cacheKey");
CREATE INDEX "FeedAnalyticsCache_expiresAt_idx" ON "FeedAnalyticsCache"("expiresAt");

CREATE INDEX "LivestockAuditLog_customerId_createdAt_idx" ON "LivestockAuditLog"("customerId", "createdAt");
CREATE INDEX "LivestockAuditLog_entityType_entityId_idx" ON "LivestockAuditLog"("entityType", "entityId");

ALTER TABLE "Livestock" ADD CONSTRAINT "Livestock_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivestockImage" ADD CONSTRAINT "LivestockImage_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivestockHealthRecord" ADD CONSTRAINT "LivestockHealthRecord_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivestockVaccination" ADD CONSTRAINT "LivestockVaccination_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedNutrition" ADD CONSTRAINT "FeedNutrition_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedInventory" ADD CONSTRAINT "FeedInventory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedInventory" ADD CONSTRAINT "FeedInventory_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedPurchase" ADD CONSTRAINT "FeedPurchase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedPurchase" ADD CONSTRAINT "FeedPurchase_feedInventoryId_fkey" FOREIGN KEY ("feedInventoryId") REFERENCES "FeedInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedPurchase" ADD CONSTRAINT "FeedPurchase_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedConsumption" ADD CONSTRAINT "FeedConsumption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedConsumption" ADD CONSTRAINT "FeedConsumption_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedConsumption" ADD CONSTRAINT "FeedConsumption_feedInventoryId_fkey" FOREIGN KEY ("feedInventoryId") REFERENCES "FeedInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedConsumption" ADD CONSTRAINT "FeedConsumption_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedVendorProduct" ADD CONSTRAINT "FeedVendorProduct_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "FeedVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedVendorProduct" ADD CONSTRAINT "FeedVendorProduct_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedRecommendationLog" ADD CONSTRAINT "FeedRecommendationLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedRecommendationLog" ADD CONSTRAINT "FeedRecommendationLog_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivestockExpense" ADD CONSTRAINT "LivestockExpense_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivestockExpense" ADD CONSTRAINT "LivestockExpense_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedAnalyticsCache" ADD CONSTRAINT "FeedAnalyticsCache_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivestockAuditLog" ADD CONSTRAINT "LivestockAuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
