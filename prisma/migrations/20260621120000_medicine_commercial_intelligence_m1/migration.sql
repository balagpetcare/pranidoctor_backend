-- Medicine Commercial Intelligence Ecosystem Phase M1: Medicine Knowledge Architecture
-- This migration adds:
-- 1. New enums for medicine commercial intelligence
-- 2. VetCompany - Bangladesh veterinary pharmaceutical company registry
-- 3. MedicineGeneric - Generic medicine VKL extension
-- 4. MedicineBrand - Brand product registry
-- 5. MedicineContract - Commercial contract intelligence
-- 6. MedicineContractBrand - Contract-brand associations
-- 7. MedicineContractAudit - Contract change audit trail
-- 8. MedicineRecommendationLog - Recommendation tracking

-- CreateEnum: VetCompanyStatus
CREATE TYPE "VetCompanyStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'PENDING_VERIFICATION'
);

-- CreateEnum: MedicineContractType
CREATE TYPE "MedicineContractType" AS ENUM (
    'SPONSOR',
    'CAMPAIGN',
    'ORGANIZATION',
    'REGIONAL'
);

-- CreateEnum: MedicineContractStatus
CREATE TYPE "MedicineContractStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'PAUSED',
    'EXPIRED',
    'CANCELLED'
);

-- CreateEnum: MedicineForm
CREATE TYPE "MedicineForm" AS ENUM (
    'TABLET',
    'CAPSULE',
    'INJECTION',
    'POWDER',
    'LIQUID',
    'BOLUS',
    'OINTMENT',
    'SPRAY',
    'OTHER'
);

-- CreateEnum: RecommendationReasonCode
CREATE TYPE "RecommendationReasonCode" AS ENUM (
    'GENERIC_FIRST',
    'CONTRACT_SPONSOR',
    'CONTRACT_CAMPAIGN',
    'CONTRACT_ORGANIZATION',
    'CONTRACT_REGIONAL',
    'AVAILABILITY_SCORE',
    'PRICE_COMPETITIVE',
    'VET_PREFERRED'
);

-- CreateTable: VetCompany (Bangladesh veterinary pharmaceutical company registry)
CREATE TABLE "vet_companies" (
    "id" TEXT NOT NULL,
    "companyCode" VARCHAR(32) NOT NULL,
    "nameBn" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "shortNameEn" VARCHAR(64),
    "licenseNumber" VARCHAR(64),
    "status" "VetCompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "contactEmail" VARCHAR(256),
    "contactPhone" VARCHAR(32),
    "websiteUrl" VARCHAR(512),
    "headOfficeAddress" TEXT,
    "regionCoverageJson" JSONB,
    "logoUrl" VARCHAR(512),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MedicineGeneric (Generic medicine VKL extension)
CREATE TABLE "medicine_generics" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "genericCode" VARCHAR(64) NOT NULL,
    "genericNameEn" TEXT NOT NULL,
    "genericNameBn" TEXT NOT NULL,
    "drugClass" VARCHAR(128),
    "antimicrobialClass" VARCHAR(64),
    "therapeuticCategory" VARCHAR(128),
    "species" "LivestockSpecies"[],
    "indicationsJson" JSONB,
    "contraindicationsJson" JSONB,
    "prescriptionRequired" BOOLEAN NOT NULL DEFAULT true,
    "bannedSubstance" BOOLEAN NOT NULL DEFAULT false,
    "controlledSubstance" BOOLEAN NOT NULL DEFAULT false,
    "defaultWithdrawalMeatDays" INTEGER,
    "defaultWithdrawalMilkDays" INTEGER,
    "knowledgeEntryId" TEXT,
    "sourceAttributionsJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_generics_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MedicineBrand (Brand product registry)
CREATE TABLE "medicine_brands" (
    "id" TEXT NOT NULL,
    "brandCode" VARCHAR(64) NOT NULL,
    "brandNameEn" TEXT NOT NULL,
    "brandNameBn" TEXT NOT NULL,
    "genericId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "strengthValue" DECIMAL(10,4),
    "strengthUnit" VARCHAR(32),
    "form" "MedicineForm" NOT NULL DEFAULT 'OTHER',
    "packSizeValue" DECIMAL(10,2),
    "packSizeUnit" VARCHAR(32),
    "mrpBdt" DECIMAL(12,2),
    "wholesaleBdt" DECIMAL(12,2),
    "bdAvailability" "BdFeedAvailability" NOT NULL DEFAULT 'WIDELY_AVAILABLE',
    "regionAvailabilityJson" JSONB,
    "registrationNumber" VARCHAR(64),
    "registrationExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discontinuedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MedicineContract (Commercial contract intelligence)
CREATE TABLE "medicine_contracts" (
    "id" TEXT NOT NULL,
    "contractCode" VARCHAR(64) NOT NULL,
    "contractType" "MedicineContractType" NOT NULL,
    "status" "MedicineContractStatus" NOT NULL DEFAULT 'DRAFT',
    "sponsorCompanyId" TEXT,
    "organizationId" VARCHAR(64),
    "campaignId" VARCHAR(64),
    "regionScope" TEXT[],
    "titleEn" TEXT NOT NULL,
    "titleBn" TEXT,
    "description" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 100,
    "sponsorWeight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "campaignWeight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "regionWeight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "organizationWeight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "rulesJson" JSONB,
    "exclusionsJson" JSONB,
    "budgetBdt" DECIMAL(14,2),
    "spentBdt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MedicineContractBrand (Contract-brand association)
CREATE TABLE "medicine_contract_brands" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "boostScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "exclusiveInContract" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicine_contract_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MedicineContractAudit (Contract change audit trail)
CREATE TABLE "medicine_contract_audits" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "eventType" VARCHAR(64) NOT NULL,
    "actorId" TEXT,
    "previousStateJson" JSONB,
    "newStateJson" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicine_contract_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MedicineRecommendationLog (Recommendation tracking)
CREATE TABLE "medicine_recommendation_logs" (
    "id" TEXT NOT NULL,
    "sessionId" VARCHAR(64),
    "userId" TEXT,
    "customerId" TEXT,
    "organizationId" VARCHAR(64),
    "genericId" TEXT NOT NULL,
    "query" TEXT,
    "species" "LivestockSpecies",
    "region" VARCHAR(64),
    "rankedBrandsJson" JSONB NOT NULL,
    "winningBrandId" TEXT,
    "contractFactorsJson" JSONB,
    "sponsorFactorsJson" JSONB,
    "reasonCodesJson" JSONB NOT NULL,
    "totalScore" DECIMAL(8,4) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "impressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clickedAt" TIMESTAMP(3),
    "selectedAt" TIMESTAMP(3),

    CONSTRAINT "medicine_recommendation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: VetCompany
CREATE UNIQUE INDEX "vet_companies_companyCode_key" ON "vet_companies"("companyCode");
CREATE INDEX "vet_companies_status_idx" ON "vet_companies"("status");
CREATE INDEX "vet_companies_nameEn_idx" ON "vet_companies"("nameEn");
CREATE INDEX "vet_companies_nameBn_idx" ON "vet_companies"("nameBn");

-- CreateIndex: MedicineGeneric
CREATE UNIQUE INDEX "medicine_generics_genericCode_key" ON "medicine_generics"("genericCode");
CREATE UNIQUE INDEX "medicine_generics_knowledgeEntryId_key" ON "medicine_generics"("knowledgeEntryId");
CREATE INDEX "medicine_generics_versionId_idx" ON "medicine_generics"("versionId");
CREATE INDEX "medicine_generics_drugClass_idx" ON "medicine_generics"("drugClass");
CREATE INDEX "medicine_generics_therapeuticCategory_idx" ON "medicine_generics"("therapeuticCategory");
CREATE INDEX "medicine_generics_isActive_idx" ON "medicine_generics"("isActive");

-- CreateIndex: MedicineBrand
CREATE UNIQUE INDEX "medicine_brands_brandCode_key" ON "medicine_brands"("brandCode");
CREATE INDEX "medicine_brands_genericId_idx" ON "medicine_brands"("genericId");
CREATE INDEX "medicine_brands_companyId_idx" ON "medicine_brands"("companyId");
CREATE INDEX "medicine_brands_form_idx" ON "medicine_brands"("form");
CREATE INDEX "medicine_brands_isActive_idx" ON "medicine_brands"("isActive");

-- CreateIndex: MedicineContract
CREATE UNIQUE INDEX "medicine_contracts_contractCode_key" ON "medicine_contracts"("contractCode");
CREATE INDEX "medicine_contracts_contractType_status_idx" ON "medicine_contracts"("contractType", "status");
CREATE INDEX "medicine_contracts_sponsorCompanyId_idx" ON "medicine_contracts"("sponsorCompanyId");
CREATE INDEX "medicine_contracts_effectiveFrom_effectiveUntil_idx" ON "medicine_contracts"("effectiveFrom", "effectiveUntil");
CREATE INDEX "medicine_contracts_organizationId_idx" ON "medicine_contracts"("organizationId");
CREATE INDEX "medicine_contracts_status_idx" ON "medicine_contracts"("status");

-- CreateIndex: MedicineContractBrand
CREATE UNIQUE INDEX "medicine_contract_brands_contractId_brandId_key" ON "medicine_contract_brands"("contractId", "brandId");
CREATE INDEX "medicine_contract_brands_brandId_idx" ON "medicine_contract_brands"("brandId");

-- CreateIndex: MedicineContractAudit
CREATE INDEX "medicine_contract_audits_contractId_createdAt_idx" ON "medicine_contract_audits"("contractId", "createdAt");

-- CreateIndex: MedicineRecommendationLog
CREATE INDEX "medicine_recommendation_logs_genericId_impressedAt_idx" ON "medicine_recommendation_logs"("genericId", "impressedAt");
CREATE INDEX "medicine_recommendation_logs_customerId_impressedAt_idx" ON "medicine_recommendation_logs"("customerId", "impressedAt");
CREATE INDEX "medicine_recommendation_logs_organizationId_impressedAt_idx" ON "medicine_recommendation_logs"("organizationId", "impressedAt");
CREATE INDEX "medicine_recommendation_logs_sessionId_idx" ON "medicine_recommendation_logs"("sessionId");

-- AddForeignKey: MedicineGeneric -> VkKnowledgeVersion
ALTER TABLE "medicine_generics" ADD CONSTRAINT "medicine_generics_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VkKnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: MedicineGeneric -> AiKnowledgeEntry
ALTER TABLE "medicine_generics" ADD CONSTRAINT "medicine_generics_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: MedicineBrand -> MedicineGeneric
ALTER TABLE "medicine_brands" ADD CONSTRAINT "medicine_brands_genericId_fkey" FOREIGN KEY ("genericId") REFERENCES "medicine_generics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: MedicineBrand -> VetCompany
ALTER TABLE "medicine_brands" ADD CONSTRAINT "medicine_brands_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "vet_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: MedicineContract -> VetCompany
ALTER TABLE "medicine_contracts" ADD CONSTRAINT "medicine_contracts_sponsorCompanyId_fkey" FOREIGN KEY ("sponsorCompanyId") REFERENCES "vet_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: MedicineContractBrand -> MedicineContract
ALTER TABLE "medicine_contract_brands" ADD CONSTRAINT "medicine_contract_brands_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "medicine_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: MedicineContractBrand -> MedicineBrand
ALTER TABLE "medicine_contract_brands" ADD CONSTRAINT "medicine_contract_brands_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "medicine_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: MedicineContractAudit -> MedicineContract
ALTER TABLE "medicine_contract_audits" ADD CONSTRAINT "medicine_contract_audits_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "medicine_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: VkMedicineKnowledgeGraphEdge (Medicine knowledge graph edges)
CREATE TABLE "vk_medicine_knowledge_graph_edges" (
    "id" TEXT NOT NULL,
    "edgeType" VARCHAR(64) NOT NULL,
    "fromEntitySlug" VARCHAR(128) NOT NULL,
    "toEntitySlug" VARCHAR(128) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "labelBn" TEXT,
    "labelEn" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vk_medicine_knowledge_graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: VkMedicineKnowledgeGraphEdge
CREATE UNIQUE INDEX "vk_medicine_knowledge_graph_edges_edgeType_fromEntitySlug_toEntitySlug_key" ON "vk_medicine_knowledge_graph_edges"("edgeType", "fromEntitySlug", "toEntitySlug");
CREATE INDEX "vk_medicine_knowledge_graph_edges_edgeType_idx" ON "vk_medicine_knowledge_graph_edges"("edgeType");
CREATE INDEX "vk_medicine_knowledge_graph_edges_fromEntitySlug_idx" ON "vk_medicine_knowledge_graph_edges"("fromEntitySlug");
CREATE INDEX "vk_medicine_knowledge_graph_edges_toEntitySlug_idx" ON "vk_medicine_knowledge_graph_edges"("toEntitySlug");
