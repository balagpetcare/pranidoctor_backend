-- CreateEnum
CREATE TYPE "AreaType" AS ENUM ('DIVISION', 'DISTRICT', 'UPAZILA', 'UNION', 'VILLAGE', 'SERVICE_AREA');

-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "code" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nameBn" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" "AreaType" NOT NULL DEFAULT 'DIVISION';

-- CreateIndex
CREATE INDEX "Area_type_idx" ON "Area"("type");

-- CreateIndex
CREATE INDEX "Area_isActive_idx" ON "Area"("isActive");

-- CreateIndex
CREATE INDEX "Area_parentId_type_idx" ON "Area"("parentId", "type");
