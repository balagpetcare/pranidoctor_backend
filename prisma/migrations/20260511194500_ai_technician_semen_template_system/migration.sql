-- Semen template system: masters, templates, technician service extensions, inventory.

-- CreateEnum
CREATE TYPE "SemenProductKind" AS ENUM ('NORMAL', 'SEXED', 'PREMIUM', 'IMPORTED', 'LOCAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SemenProviderVerificationStatus" AS ENUM ('UNVERIFIED', 'PARTNER', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "SemenTemplateApprovalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SemenTemplateMediaKind" AS ENUM ('COVER', 'GALLERY', 'VIDEO_UPLOAD', 'VIDEO_URL');

-- AlterEnum
ALTER TYPE "MobileUploadPurpose" ADD VALUE 'ADMIN_SEMEN_PROVIDER_LOGO';
ALTER TYPE "MobileUploadPurpose" ADD VALUE 'ADMIN_SEMEN_TEMPLATE_COVER';
ALTER TYPE "MobileUploadPurpose" ADD VALUE 'ADMIN_SEMEN_TEMPLATE_GALLERY';

-- CreateTable
CREATE TABLE "SemenProvider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "description" TEXT,
    "descriptionBn" TEXT,
    "logoUploadedFileId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" "SemenProviderVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemenProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockBreed" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "animalType" "AnimalType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivestockBreed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemenServiceTemplate" (
    "id" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "animalType" "AnimalType" NOT NULL,
    "semenProviderId" TEXT NOT NULL,
    "semenProductKind" "SemenProductKind" NOT NULL,
    "otherSemenLabel" TEXT,
    "shortDescription" TEXT,
    "detailedDescription" TEXT,
    "expectedBenefits" TEXT,
    "recommendedAnimalCondition" TEXT,
    "warningsContraindications" TEXT,
    "defaultBasePrice" DECIMAL(12,2) NOT NULL,
    "defaultOfferPrice" DECIMAL(12,2),
    "defaultDiscountPercent" DECIMAL(5,2),
    "tagsJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "SemenTemplateApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemenServiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemenServiceTemplateBreedMix" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "breedId" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemenServiceTemplateBreedMix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemenServiceTemplateMedia" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "kind" "SemenTemplateMediaKind" NOT NULL,
    "uploadedFileId" TEXT,
    "externalUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemenServiceTemplateMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianSemenInventory" (
    "id" TEXT NOT NULL,
    "aiTechnicianServiceId" TEXT NOT NULL,
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "usedQuantity" INTEGER NOT NULL DEFAULT 0,
    "minStockAlert" INTEGER,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "sourceNote" TEXT,
    "storageNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianSemenInventory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AiTechnicianService" ADD COLUMN     "semenServiceTemplateId" TEXT,
ADD COLUMN     "offerPrice" DECIMAL(12,2),
ADD COLUMN     "discountPercent" DECIMAL(5,2),
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "technicianServiceNote" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SemenProvider_slug_key" ON "SemenProvider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SemenProvider_logoUploadedFileId_key" ON "SemenProvider"("logoUploadedFileId");

-- CreateIndex
CREATE INDEX "SemenProvider_isActive_idx" ON "SemenProvider"("isActive");

-- CreateIndex
CREATE INDEX "SemenProvider_sortOrder_idx" ON "SemenProvider"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LivestockBreed_slug_key" ON "LivestockBreed"("slug");

-- CreateIndex
CREATE INDEX "LivestockBreed_animalType_idx" ON "LivestockBreed"("animalType");

-- CreateIndex
CREATE INDEX "LivestockBreed_isActive_idx" ON "LivestockBreed"("isActive");

-- CreateIndex
CREATE INDEX "SemenServiceTemplate_semenProviderId_idx" ON "SemenServiceTemplate"("semenProviderId");

-- CreateIndex
CREATE INDEX "SemenServiceTemplate_animalType_idx" ON "SemenServiceTemplate"("animalType");

-- CreateIndex
CREATE INDEX "SemenServiceTemplate_approvalStatus_isActive_idx" ON "SemenServiceTemplate"("approvalStatus", "isActive");

-- CreateIndex
CREATE INDEX "SemenServiceTemplateBreedMix_breedId_idx" ON "SemenServiceTemplateBreedMix"("breedId");

-- CreateIndex
CREATE UNIQUE INDEX "SemenServiceTemplateBreedMix_templateId_breedId_key" ON "SemenServiceTemplateBreedMix"("templateId", "breedId");

-- CreateIndex
CREATE UNIQUE INDEX "SemenServiceTemplateMedia_uploadedFileId_key" ON "SemenServiceTemplateMedia"("uploadedFileId");

-- CreateIndex
CREATE INDEX "SemenServiceTemplateMedia_templateId_idx" ON "SemenServiceTemplateMedia"("templateId");

-- CreateIndex
CREATE INDEX "SemenServiceTemplateMedia_sortOrder_idx" ON "SemenServiceTemplateMedia"("sortOrder");

-- CreateIndex
CREATE INDEX "TechnicianSemenInventory_aiTechnicianServiceId_idx" ON "TechnicianSemenInventory"("aiTechnicianServiceId");

-- CreateIndex
CREATE INDEX "TechnicianSemenInventory_isActive_idx" ON "TechnicianSemenInventory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AiTechnicianService_aiTechnicianId_semenServiceTemplateId_key" ON "AiTechnicianService"("aiTechnicianId", "semenServiceTemplateId");

-- CreateIndex
CREATE INDEX "AiTechnicianService_semenServiceTemplateId_idx" ON "AiTechnicianService"("semenServiceTemplateId");

-- AddForeignKey
ALTER TABLE "SemenProvider" ADD CONSTRAINT "SemenProvider_logoUploadedFileId_fkey" FOREIGN KEY ("logoUploadedFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenServiceTemplate" ADD CONSTRAINT "SemenServiceTemplate_semenProviderId_fkey" FOREIGN KEY ("semenProviderId") REFERENCES "SemenProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenServiceTemplate" ADD CONSTRAINT "SemenServiceTemplate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenServiceTemplateBreedMix" ADD CONSTRAINT "SemenServiceTemplateBreedMix_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SemenServiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenServiceTemplateBreedMix" ADD CONSTRAINT "SemenServiceTemplateBreedMix_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "LivestockBreed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenServiceTemplateMedia" ADD CONSTRAINT "SemenServiceTemplateMedia_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SemenServiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenServiceTemplateMedia" ADD CONSTRAINT "SemenServiceTemplateMedia_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianService" ADD CONSTRAINT "AiTechnicianService_semenServiceTemplateId_fkey" FOREIGN KEY ("semenServiceTemplateId") REFERENCES "SemenServiceTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianSemenInventory" ADD CONSTRAINT "TechnicianSemenInventory_aiTechnicianServiceId_fkey" FOREIGN KEY ("aiTechnicianServiceId") REFERENCES "AiTechnicianService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
