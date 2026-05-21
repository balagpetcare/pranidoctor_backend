/*
  Warnings:

  - The `status` column on the `BillingRecord` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `type` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `TreatmentRecord` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "AnimalType" AS ENUM ('CATTLE', 'GOAT', 'POULTRY', 'DOG', 'CAT', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('DOCTOR_VISIT', 'EMERGENCY', 'AI_SERVICE', 'ONLINE_CONSULTATION');

-- CreateEnum
CREATE TYPE "TreatmentCaseStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REQUEST_UPDATE', 'PAYMENT', 'CHAT', 'SYSTEM', 'MARKETING', 'COMPLAINT', 'REVIEW');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServiceRequestStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "ServiceRequestStatus" ADD VALUE 'DISPATCHED';
ALTER TYPE "ServiceRequestStatus" ADD VALUE 'NO_SHOW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'AI_TECHNICIAN';
ALTER TYPE "UserRole" ADD VALUE 'SUPPORT';
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserStatus" ADD VALUE 'INVITED';
ALTER TYPE "UserStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "AnimalProfile" ADD COLUMN     "animalType" "AnimalType",
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "weightKg" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "BillingRecord" ADD COLUMN     "aiTechnicianId" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(14,2),
ADD COLUMN     "medicineCost" DECIMAL(14,2),
ADD COLUMN     "platformCommission" DECIMAL(14,2),
ADD COLUMN     "providerPayout" DECIMAL(14,2),
ADD COLUMN     "serviceFee" DECIMAL(14,2),
ADD COLUMN     "totalCollected" DECIMAL(14,2),
ADD COLUMN     "travelCost" DECIMAL(14,2),
ADD COLUMN     "treatmentCaseId" TEXT,
ALTER COLUMN "doctorId" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "BillingStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "subtotal" DROP NOT NULL,
ALTER COLUMN "tax" DROP NOT NULL,
ALTER COLUMN "total" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DoctorProfile" ADD COLUMN     "providerStatus" "ProviderStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION';

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM';

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "aiTechnicianId" TEXT,
ALTER COLUMN "doctorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "assignedAiTechnicianId" TEXT,
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "emergencyNotes" TEXT,
ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requestType" "ServiceRequestType" NOT NULL DEFAULT 'DOCTOR_VISIT',
ADD COLUMN     "scheduledEnd" TIMESTAMP(3),
ADD COLUMN     "scheduledStart" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "villageId" TEXT,
ALTER COLUMN "areaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TreatmentRecord" ADD COLUMN     "aiTechnicianId" TEXT,
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "symptoms" TEXT,
ADD COLUMN     "treatmentNotes" TEXT,
ALTER COLUMN "doctorId" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TreatmentCaseStatus" NOT NULL DEFAULT 'DRAFT';

-- DropEnum
DROP TYPE "BillingRecordStatus";

-- DropEnum
DROP TYPE "TreatmentRecordStatus";

-- CreateTable
CREATE TABLE "AiTechnicianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certification" TEXT,
    "bio" TEXT,
    "providerStatus" "ProviderStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTechnicianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upazila" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upazila_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Union" (
    "id" TEXT NOT NULL,
    "upazilaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Union_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Village" (
    "id" TEXT NOT NULL,
    "unionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorServiceArea" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTechnicianServiceArea" (
    "id" TEXT NOT NULL,
    "aiTechnicianId" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTechnicianServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "dosage" TEXT,
    "duration" TEXT,
    "instruction" TEXT,
    "quantity" DECIMAL(12,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "billingRecordId" TEXT,
    "serviceRequestId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "externalId" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "doctorId" TEXT,
    "aiTechnicianId" TEXT,
    "serviceRequestId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "animalType" "AnimalType",
    "body" TEXT NOT NULL,
    "videoUrl" TEXT,
    "imageUrl" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "authorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "doctorId" TEXT,
    "aiTechnicianId" TEXT,
    "adminAssigneeId" TEXT,
    "serviceRequestId" TEXT,
    "billingRecordId" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiTechnicianProfile_userId_key" ON "AiTechnicianProfile"("userId");

-- CreateIndex
CREATE INDEX "AiTechnicianProfile_providerStatus_idx" ON "AiTechnicianProfile"("providerStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Division_slug_key" ON "Division"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "District_slug_key" ON "District"("slug");

-- CreateIndex
CREATE INDEX "District_divisionId_idx" ON "District"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Upazila_slug_key" ON "Upazila"("slug");

-- CreateIndex
CREATE INDEX "Upazila_districtId_idx" ON "Upazila"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Union_slug_key" ON "Union"("slug");

-- CreateIndex
CREATE INDEX "Union_upazilaId_idx" ON "Union"("upazilaId");

-- CreateIndex
CREATE UNIQUE INDEX "Village_slug_key" ON "Village"("slug");

-- CreateIndex
CREATE INDEX "Village_unionId_idx" ON "Village"("unionId");

-- CreateIndex
CREATE INDEX "DoctorServiceArea_villageId_idx" ON "DoctorServiceArea"("villageId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorServiceArea_doctorId_villageId_key" ON "DoctorServiceArea"("doctorId", "villageId");

-- CreateIndex
CREATE INDEX "AiTechnicianServiceArea_villageId_idx" ON "AiTechnicianServiceArea"("villageId");

-- CreateIndex
CREATE UNIQUE INDEX "AiTechnicianServiceArea_aiTechnicianId_villageId_key" ON "AiTechnicianServiceArea"("aiTechnicianId", "villageId");

-- CreateIndex
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

-- CreateIndex
CREATE INDEX "PaymentRecord_billingRecordId_idx" ON "PaymentRecord"("billingRecordId");

-- CreateIndex
CREATE INDEX "PaymentRecord_serviceRequestId_idx" ON "PaymentRecord"("serviceRequestId");

-- CreateIndex
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");

-- CreateIndex
CREATE INDEX "PaymentRecord_externalId_idx" ON "PaymentRecord"("externalId");

-- CreateIndex
CREATE INDEX "Review_customerId_serviceRequestId_idx" ON "Review"("customerId", "serviceRequestId");

-- CreateIndex
CREATE INDEX "Review_doctorId_idx" ON "Review"("doctorId");

-- CreateIndex
CREATE INDEX "Review_aiTechnicianId_idx" ON "Review"("aiTechnicianId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPost_slug_key" ON "ContentPost"("slug");

-- CreateIndex
CREATE INDEX "ContentPost_status_idx" ON "ContentPost"("status");

-- CreateIndex
CREATE INDEX "ContentPost_authorUserId_idx" ON "ContentPost"("authorUserId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE INDEX "Complaint_customerId_idx" ON "Complaint"("customerId");

-- CreateIndex
CREATE INDEX "Complaint_adminAssigneeId_idx" ON "Complaint"("adminAssigneeId");

-- CreateIndex
CREATE INDEX "BillingRecord_aiTechnicianId_idx" ON "BillingRecord"("aiTechnicianId");

-- CreateIndex
CREATE INDEX "BillingRecord_status_idx" ON "BillingRecord"("status");

-- CreateIndex
CREATE INDEX "DoctorProfile_providerStatus_idx" ON "DoctorProfile"("providerStatus");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Prescription_doctorId_idx" ON "Prescription"("doctorId");

-- CreateIndex
CREATE INDEX "Prescription_aiTechnicianId_idx" ON "Prescription"("aiTechnicianId");

-- CreateIndex
CREATE INDEX "ServiceRequest_animalId_idx" ON "ServiceRequest"("animalId");

-- CreateIndex
CREATE INDEX "ServiceRequest_assignedAiTechnicianId_status_idx" ON "ServiceRequest"("assignedAiTechnicianId", "status");

-- CreateIndex
CREATE INDEX "ServiceRequest_requestType_status_idx" ON "ServiceRequest"("requestType", "status");

-- CreateIndex
CREATE INDEX "ServiceRequest_villageId_idx" ON "ServiceRequest"("villageId");

-- CreateIndex
CREATE INDEX "TreatmentRecord_aiTechnicianId_idx" ON "TreatmentRecord"("aiTechnicianId");

-- CreateIndex
CREATE INDEX "TreatmentRecord_status_idx" ON "TreatmentRecord"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- AddForeignKey
ALTER TABLE "AiTechnicianProfile" ADD CONSTRAINT "AiTechnicianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upazila" ADD CONSTRAINT "Upazila_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Union" ADD CONSTRAINT "Union_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Village" ADD CONSTRAINT "Village_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "Union"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorServiceArea" ADD CONSTRAINT "DoctorServiceArea_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorServiceArea" ADD CONSTRAINT "DoctorServiceArea_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianServiceArea" ADD CONSTRAINT "AiTechnicianServiceArea_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianServiceArea" ADD CONSTRAINT "AiTechnicianServiceArea_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedAiTechnicianId_fkey" FOREIGN KEY ("assignedAiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_treatmentCaseId_fkey" FOREIGN KEY ("treatmentCaseId") REFERENCES "TreatmentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_billingRecordId_fkey" FOREIGN KEY ("billingRecordId") REFERENCES "BillingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_adminAssigneeId_fkey" FOREIGN KEY ("adminAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_billingRecordId_fkey" FOREIGN KEY ("billingRecordId") REFERENCES "BillingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
