-- CreateEnum
CREATE TYPE "MobileUploadPurpose" AS ENUM ('AI_TECHNICIAN_NID_FRONT', 'AI_TECHNICIAN_NID_BACK', 'AI_TECHNICIAN_PROFILE_PHOTO', 'AI_TECHNICIAN_TRAINING_CERTIFICATE', 'AI_TECHNICIAN_AI_CERTIFICATE', 'AI_TECHNICIAN_OTHER');

-- CreateEnum
CREATE TYPE "UploadedFileStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileCategory" "MobileUploadPurpose" NOT NULL,
    "publicUrl" TEXT,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "status" "UploadedFileStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadedFile_storageKey_key" ON "UploadedFile"("storageKey");

-- CreateIndex
CREATE INDEX "UploadedFile_ownerUserId_idx" ON "UploadedFile"("ownerUserId");

-- CreateIndex
CREATE INDEX "UploadedFile_status_idx" ON "UploadedFile"("status");

-- CreateIndex
CREATE INDEX "UploadedFile_fileCategory_idx" ON "UploadedFile"("fileCategory");

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AiTechnicianDocument" ADD COLUMN "uploadedFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AiTechnicianDocument_uploadedFileId_key" ON "AiTechnicianDocument"("uploadedFileId");

-- AddForeignKey
ALTER TABLE "AiTechnicianDocument" ADD CONSTRAINT "AiTechnicianDocument_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
