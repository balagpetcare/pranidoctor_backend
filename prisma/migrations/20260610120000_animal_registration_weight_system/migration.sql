-- Animal Registration Weight System V1

CREATE TYPE "AnimalWeightMethod" AS ENUM ('TAPE', 'SCALE', 'AI_CAMERA', 'SMART_SCALE');
CREATE TYPE "AnimalWeightMeasurementSource" AS ENUM ('REGISTRATION', 'ANIMAL_DETAIL', 'FATTENING_BRIDGE', 'SMART_SCALE');
CREATE TYPE "AnimalWeightAiJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

ALTER TYPE "MobileUploadPurpose" ADD VALUE IF NOT EXISTS 'ANIMAL_WEIGHT_SCALE_PHOTO';
ALTER TYPE "MobileUploadPurpose" ADD VALUE IF NOT EXISTS 'ANIMAL_WEIGHT_AI_IMAGE';
ALTER TYPE "MobileUploadPurpose" ADD VALUE IF NOT EXISTS 'ANIMAL_WEIGHT_AI_VIDEO';

ALTER TABLE "AnimalProfile" ADD COLUMN "lastWeightMethod" "AnimalWeightMethod";
ALTER TABLE "AnimalProfile" ADD COLUMN "lastWeightMeasuredAt" TIMESTAMP(3);

CREATE TABLE "AnimalWeightAiJob" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "animalId" TEXT,
    "registrationDraftId" TEXT,
    "status" "AnimalWeightAiJobStatus" NOT NULL DEFAULT 'PENDING',
    "animalType" "AnimalType",
    "uploadIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUploadId" TEXT,
    "frameUploadIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resultWeightKg" DECIMAL(10,3),
    "confidence" DECIMAL(5,4),
    "modelId" TEXT,
    "providerId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "promptVersion" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalWeightAiJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnimalWeightMeasurement" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "method" "AnimalWeightMethod" NOT NULL,
    "source" "AnimalWeightMeasurementSource" NOT NULL DEFAULT 'REGISTRATION',
    "weightKg" DECIMAL(10,3) NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measuredOn" DATE NOT NULL,
    "heartGirthCm" DECIMAL(8,2),
    "bodyLengthCm" DECIMAL(8,2),
    "tapeFormulaId" TEXT,
    "tapeEstimatedKg" DECIMAL(10,3),
    "scalePhotoUrl" TEXT,
    "aiJobId" TEXT,
    "aiConfidence" DECIMAL(5,4),
    "aiModelId" TEXT,
    "aiDisclaimerAck" BOOLEAN NOT NULL DEFAULT false,
    "mediaAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceVendor" TEXT,
    "deviceModel" TEXT,
    "deviceReadingId" TEXT,
    "devicePayload" JSONB,
    "linkedWeightRecordId" TEXT,
    "clientMeasurementId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalWeightMeasurement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnimalWeightMeasurement_aiJobId_key" ON "AnimalWeightMeasurement"("aiJobId");
CREATE UNIQUE INDEX "AnimalWeightMeasurement_linkedWeightRecordId_key" ON "AnimalWeightMeasurement"("linkedWeightRecordId");
CREATE UNIQUE INDEX "AnimalWeightMeasurement_customerId_clientMeasurementId_key" ON "AnimalWeightMeasurement"("customerId", "clientMeasurementId");
CREATE INDEX "AnimalWeightMeasurement_customerId_animalId_measuredAt_idx" ON "AnimalWeightMeasurement"("customerId", "animalId", "measuredAt");
CREATE INDEX "AnimalWeightMeasurement_animalId_method_measuredOn_idx" ON "AnimalWeightMeasurement"("animalId", "method", "measuredOn");
CREATE INDEX "AnimalWeightAiJob_customerId_status_requestedAt_idx" ON "AnimalWeightAiJob"("customerId", "status", "requestedAt");
CREATE INDEX "AnimalWeightAiJob_animalId_idx" ON "AnimalWeightAiJob"("animalId");

ALTER TABLE "AnimalWeightAiJob" ADD CONSTRAINT "AnimalWeightAiJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnimalWeightMeasurement" ADD CONSTRAINT "AnimalWeightMeasurement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalWeightMeasurement" ADD CONSTRAINT "AnimalWeightMeasurement_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalWeightMeasurement" ADD CONSTRAINT "AnimalWeightMeasurement_aiJobId_fkey" FOREIGN KEY ("aiJobId") REFERENCES "AnimalWeightAiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnimalWeightMeasurement" ADD CONSTRAINT "AnimalWeightMeasurement_linkedWeightRecordId_fkey" FOREIGN KEY ("linkedWeightRecordId") REFERENCES "WeightRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
