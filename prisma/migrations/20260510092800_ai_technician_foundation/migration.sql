-- CreateEnum
CREATE TYPE "AiTechnicianStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CORRECTION', 'APPROVED', 'PUBLISHED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AiTechnicianDocumentType" AS ENUM ('NID_FRONT', 'NID_BACK', 'PROFILE_PHOTO', 'TRAINING_CERTIFICATE', 'AI_CERTIFICATE', 'COMPANY_ID', 'EXPERIENCE_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "AiTechnicianDocumentReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AiTechnicianServiceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "AiServiceRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiPaymentStatus" AS ENUM ('UNPAID', 'CASH_PAID', 'MANUAL_PAID', 'DUE', 'REFUNDED');

-- AlterTable
ALTER TABLE "AiTechnicianProfile" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "certificateNumber" TEXT,
ADD COLUMN     "correctionNote" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "district" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "nidNumber" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "presentAddress" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "AiTechnicianStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
ADD COLUMN     "trainingProvider" TEXT,
ADD COLUMN     "unionOrArea" TEXT,
ADD COLUMN     "upazila" TEXT;

-- CreateTable
CREATE TABLE "AiTechnicianDivisionServiceArea" (
    "id" TEXT NOT NULL,
    "aiTechnicianId" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "upazila" TEXT NOT NULL,
    "unionOrArea" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTechnicianDivisionServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTechnicianDocument" (
    "id" TEXT NOT NULL,
    "aiTechnicianId" TEXT NOT NULL,
    "type" "AiTechnicianDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "reviewStatus" "AiTechnicianDocumentReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTechnicianDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTechnicianService" (
    "id" TEXT NOT NULL,
    "aiTechnicianId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "animalType" "AnimalType" NOT NULL,
    "breedOrSemenType" TEXT,
    "description" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "visitFee" DECIMAL(12,2),
    "emergencyFee" DECIMAL(12,2),
    "repeatServicePolicy" TEXT,
    "followUpIncluded" BOOLEAN NOT NULL DEFAULT false,
    "status" "AiTechnicianServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTechnicianService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiServiceRequest" (
    "id" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "technicianProfileId" TEXT,
    "serviceId" TEXT,
    "animalType" "AnimalType" NOT NULL,
    "breed" TEXT,
    "animalAge" TEXT,
    "lastHeatDate" TIMESTAMP(3),
    "heatSymptoms" TEXT,
    "previousAiHistory" TEXT,
    "healthIssueNote" TEXT,
    "district" TEXT NOT NULL,
    "upazila" TEXT NOT NULL,
    "unionOrArea" TEXT,
    "addressDetail" TEXT,
    "preferredTime" TEXT,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "status" "AiServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedFee" DECIMAL(12,2),
    "finalFee" DECIMAL(12,2),
    "paymentStatus" "AiPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "linkedServiceRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiServiceRecord" (
    "id" TEXT NOT NULL,
    "aiServiceRequestId" TEXT NOT NULL,
    "technicianProfileId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "animalType" "AnimalType" NOT NULL,
    "breedOrSemenType" TEXT,
    "semenBatch" TEXT,
    "heatObservation" TEXT,
    "inseminationTime" TIMESTAMP(3),
    "serviceNote" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "pregnancyCheckDate" TIMESTAMP(3),
    "totalFee" DECIMAL(12,2),
    "paymentStatus" "AiPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiTechnicianDivisionServiceArea_aiTechnicianId_idx" ON "AiTechnicianDivisionServiceArea"("aiTechnicianId");

-- CreateIndex
CREATE INDEX "AiTechnicianDivisionServiceArea_district_upazila_idx" ON "AiTechnicianDivisionServiceArea"("district", "upazila");

-- CreateIndex
CREATE INDEX "AiTechnicianDocument_aiTechnicianId_idx" ON "AiTechnicianDocument"("aiTechnicianId");

-- CreateIndex
CREATE INDEX "AiTechnicianDocument_type_idx" ON "AiTechnicianDocument"("type");

-- CreateIndex
CREATE INDEX "AiTechnicianService_aiTechnicianId_idx" ON "AiTechnicianService"("aiTechnicianId");

-- CreateIndex
CREATE INDEX "AiTechnicianService_status_idx" ON "AiTechnicianService"("status");

-- CreateIndex
CREATE INDEX "AiTechnicianService_animalType_idx" ON "AiTechnicianService"("animalType");

-- CreateIndex
CREATE UNIQUE INDEX "AiServiceRequest_linkedServiceRequestId_key" ON "AiServiceRequest"("linkedServiceRequestId");

-- CreateIndex
CREATE INDEX "AiServiceRequest_customerUserId_idx" ON "AiServiceRequest"("customerUserId");

-- CreateIndex
CREATE INDEX "AiServiceRequest_technicianProfileId_idx" ON "AiServiceRequest"("technicianProfileId");

-- CreateIndex
CREATE INDEX "AiServiceRequest_status_idx" ON "AiServiceRequest"("status");

-- CreateIndex
CREATE INDEX "AiServiceRequest_createdAt_idx" ON "AiServiceRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiServiceRecord_aiServiceRequestId_key" ON "AiServiceRecord"("aiServiceRequestId");

-- CreateIndex
CREATE INDEX "AiServiceRecord_technicianProfileId_idx" ON "AiServiceRecord"("technicianProfileId");

-- CreateIndex
CREATE INDEX "AiServiceRecord_customerUserId_idx" ON "AiServiceRecord"("customerUserId");

-- CreateIndex
CREATE INDEX "AiServiceRecord_serviceDate_idx" ON "AiServiceRecord"("serviceDate");

-- CreateIndex
CREATE INDEX "AiTechnicianProfile_status_idx" ON "AiTechnicianProfile"("status");

-- CreateIndex
CREATE INDEX "AiTechnicianProfile_reviewedById_idx" ON "AiTechnicianProfile"("reviewedById");

-- AddForeignKey
ALTER TABLE "AiTechnicianProfile" ADD CONSTRAINT "AiTechnicianProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianDivisionServiceArea" ADD CONSTRAINT "AiTechnicianDivisionServiceArea_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianDocument" ADD CONSTRAINT "AiTechnicianDocument_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianService" ADD CONSTRAINT "AiTechnicianService_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiServiceRequest" ADD CONSTRAINT "AiServiceRequest_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiServiceRequest" ADD CONSTRAINT "AiServiceRequest_technicianProfileId_fkey" FOREIGN KEY ("technicianProfileId") REFERENCES "AiTechnicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiServiceRequest" ADD CONSTRAINT "AiServiceRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "AiTechnicianService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiServiceRequest" ADD CONSTRAINT "AiServiceRequest_linkedServiceRequestId_fkey" FOREIGN KEY ("linkedServiceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiServiceRecord" ADD CONSTRAINT "AiServiceRecord_aiServiceRequestId_fkey" FOREIGN KEY ("aiServiceRequestId") REFERENCES "AiServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiServiceRecord" ADD CONSTRAINT "AiServiceRecord_technicianProfileId_fkey" FOREIGN KEY ("technicianProfileId") REFERENCES "AiTechnicianProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiServiceRecord" ADD CONSTRAINT "AiServiceRecord_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data backfill: align new `status` with legacy `providerStatus` for existing technician rows
UPDATE "AiTechnicianProfile" SET "status" = 'PUBLISHED' WHERE "providerStatus" = 'ACTIVE';
UPDATE "AiTechnicianProfile" SET "status" = 'SUSPENDED' WHERE "providerStatus" = 'SUSPENDED';
UPDATE "AiTechnicianProfile" SET "status" = 'REJECTED' WHERE "providerStatus" = 'REJECTED';
UPDATE "AiTechnicianProfile" SET "status" = 'UNDER_REVIEW' WHERE "providerStatus" = 'PENDING_VERIFICATION';
