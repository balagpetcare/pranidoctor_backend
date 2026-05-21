-- CreateEnum
CREATE TYPE "AiTechnicianReviewVisibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "AiTechnicianComplaintStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AiTechnicianReview" (
    "id" TEXT NOT NULL,
    "aiServiceRequestId" TEXT NOT NULL,
    "technicianProfileId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "visibility" "AiTechnicianReviewVisibility" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTechnicianReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTechnicianComplaint" (
    "id" TEXT NOT NULL,
    "aiServiceRequestId" TEXT,
    "technicianProfileId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AiTechnicianComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTechnicianComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiTechnicianReview_aiServiceRequestId_key" ON "AiTechnicianReview"("aiServiceRequestId");

-- CreateIndex
CREATE INDEX "AiTechnicianReview_technicianProfileId_idx" ON "AiTechnicianReview"("technicianProfileId");

-- CreateIndex
CREATE INDEX "AiTechnicianReview_customerUserId_idx" ON "AiTechnicianReview"("customerUserId");

-- CreateIndex
CREATE INDEX "AiTechnicianReview_visibility_idx" ON "AiTechnicianReview"("visibility");

-- CreateIndex
CREATE INDEX "AiTechnicianComplaint_technicianProfileId_idx" ON "AiTechnicianComplaint"("technicianProfileId");

-- CreateIndex
CREATE INDEX "AiTechnicianComplaint_customerUserId_idx" ON "AiTechnicianComplaint"("customerUserId");

-- CreateIndex
CREATE INDEX "AiTechnicianComplaint_status_idx" ON "AiTechnicianComplaint"("status");

-- CreateIndex
CREATE INDEX "AiTechnicianComplaint_aiServiceRequestId_idx" ON "AiTechnicianComplaint"("aiServiceRequestId");

-- AddForeignKey
ALTER TABLE "AiTechnicianReview" ADD CONSTRAINT "AiTechnicianReview_aiServiceRequestId_fkey" FOREIGN KEY ("aiServiceRequestId") REFERENCES "AiServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianReview" ADD CONSTRAINT "AiTechnicianReview_technicianProfileId_fkey" FOREIGN KEY ("technicianProfileId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianReview" ADD CONSTRAINT "AiTechnicianReview_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianComplaint" ADD CONSTRAINT "AiTechnicianComplaint_aiServiceRequestId_fkey" FOREIGN KEY ("aiServiceRequestId") REFERENCES "AiServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianComplaint" ADD CONSTRAINT "AiTechnicianComplaint_technicianProfileId_fkey" FOREIGN KEY ("technicianProfileId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianComplaint" ADD CONSTRAINT "AiTechnicianComplaint_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
