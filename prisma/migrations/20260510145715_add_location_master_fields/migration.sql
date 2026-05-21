/*
  Warnings:

  - Non-unique indexes on (parentId, code) — legacy seeds may duplicate `code` under the same parent.

*/
-- AlterTable
ALTER TABLE "District" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "Division" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "Union" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "Upazila" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "Village" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "nameBn" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE INDEX "District_divisionId_code_idx" ON "District"("divisionId", "code");

-- CreateIndex
CREATE INDEX "District_divisionId_nameBn_idx" ON "District"("divisionId", "nameBn");

-- CreateIndex
CREATE INDEX "District_divisionId_nameEn_idx" ON "District"("divisionId", "nameEn");

-- CreateIndex
CREATE INDEX "Division_code_idx" ON "Division"("code");

-- CreateIndex
CREATE INDEX "Division_nameBn_idx" ON "Division"("nameBn");

-- CreateIndex
CREATE INDEX "Division_nameEn_idx" ON "Division"("nameEn");

-- CreateIndex
CREATE INDEX "Upazila_districtId_code_idx" ON "Upazila"("districtId", "code");

-- CreateIndex
CREATE INDEX "Upazila_districtId_nameBn_idx" ON "Upazila"("districtId", "nameBn");

-- CreateIndex
CREATE INDEX "Upazila_districtId_nameEn_idx" ON "Upazila"("districtId", "nameEn");

-- CreateIndex
CREATE INDEX "Union_upazilaId_code_idx" ON "Union"("upazilaId", "code");

-- CreateIndex
CREATE INDEX "Union_upazilaId_nameBn_idx" ON "Union"("upazilaId", "nameBn");

-- CreateIndex
CREATE INDEX "Union_upazilaId_nameEn_idx" ON "Union"("upazilaId", "nameEn");

-- CreateIndex
CREATE INDEX "Village_unionId_nameBn_idx" ON "Village"("unionId", "nameBn");

-- CreateIndex
CREATE INDEX "Village_unionId_nameEn_idx" ON "Village"("unionId", "nameEn");

-- CreateIndex
CREATE INDEX "Village_isActive_idx" ON "Village"("isActive");
