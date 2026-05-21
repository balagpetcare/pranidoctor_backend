-- AlterTable
ALTER TABLE "AiTechnicianDivisionServiceArea" ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "unionId" TEXT,
ADD COLUMN     "upazilaId" TEXT;

-- AlterTable
ALTER TABLE "AiTechnicianProfile" ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "unionId" TEXT,
ADD COLUMN     "upazilaId" TEXT;

-- AlterTable
ALTER TABLE "District" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nameBn" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Division" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nameBn" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Union" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nameBn" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Upazila" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nameBn" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AiTechnicianDivisionServiceArea_districtId_idx" ON "AiTechnicianDivisionServiceArea"("districtId");

-- CreateIndex
CREATE INDEX "AiTechnicianDivisionServiceArea_upazilaId_idx" ON "AiTechnicianDivisionServiceArea"("upazilaId");

-- CreateIndex
CREATE INDEX "AiTechnicianDivisionServiceArea_unionId_idx" ON "AiTechnicianDivisionServiceArea"("unionId");

-- CreateIndex
CREATE INDEX "AiTechnicianProfile_districtId_idx" ON "AiTechnicianProfile"("districtId");

-- CreateIndex
CREATE INDEX "AiTechnicianProfile_upazilaId_idx" ON "AiTechnicianProfile"("upazilaId");

-- CreateIndex
CREATE INDEX "AiTechnicianProfile_unionId_idx" ON "AiTechnicianProfile"("unionId");

-- CreateIndex
CREATE INDEX "District_isActive_idx" ON "District"("isActive");

-- CreateIndex
CREATE INDEX "Division_isActive_idx" ON "Division"("isActive");

-- CreateIndex
CREATE INDEX "Union_isActive_idx" ON "Union"("isActive");

-- CreateIndex
CREATE INDEX "Upazila_isActive_idx" ON "Upazila"("isActive");

-- AddForeignKey
ALTER TABLE "AiTechnicianProfile" ADD CONSTRAINT "AiTechnicianProfile_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianProfile" ADD CONSTRAINT "AiTechnicianProfile_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianProfile" ADD CONSTRAINT "AiTechnicianProfile_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "Union"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianDivisionServiceArea" ADD CONSTRAINT "AiTechnicianDivisionServiceArea_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianDivisionServiceArea" ADD CONSTRAINT "AiTechnicianDivisionServiceArea_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianDivisionServiceArea" ADD CONSTRAINT "AiTechnicianDivisionServiceArea_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "Union"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill bilingual labels from legacy `name` (English-oriented seeds)
UPDATE "Division" SET "nameEn" = "name" WHERE "nameEn" IS NULL;
UPDATE "District" SET "nameEn" = "name" WHERE "nameEn" IS NULL;
UPDATE "Upazila" SET "nameEn" = "name" WHERE "nameEn" IS NULL;
UPDATE "Union" SET "nameEn" = "name" WHERE "nameEn" IS NULL;
