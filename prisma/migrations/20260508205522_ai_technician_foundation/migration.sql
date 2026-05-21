-- AlterTable
ALTER TABLE "AiTechnicianProfile" ADD COLUMN     "acceptsEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "serviceFeeBdt" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "AiTechnicianProfileArea" (
    "id" TEXT NOT NULL,
    "aiTechnicianId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTechnicianProfileArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTechnicianProfileServiceCategory" (
    "id" TEXT NOT NULL,
    "aiTechnicianId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTechnicianProfileServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiTechnicianProfileArea_areaId_idx" ON "AiTechnicianProfileArea"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "AiTechnicianProfileArea_aiTechnicianId_areaId_key" ON "AiTechnicianProfileArea"("aiTechnicianId", "areaId");

-- CreateIndex
CREATE INDEX "AiTechnicianProfileServiceCategory_serviceCategoryId_idx" ON "AiTechnicianProfileServiceCategory"("serviceCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AiTechnicianProfileServiceCategory_aiTechnicianId_serviceCa_key" ON "AiTechnicianProfileServiceCategory"("aiTechnicianId", "serviceCategoryId");

-- AddForeignKey
ALTER TABLE "AiTechnicianProfileArea" ADD CONSTRAINT "AiTechnicianProfileArea_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianProfileArea" ADD CONSTRAINT "AiTechnicianProfileArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianProfileServiceCategory" ADD CONSTRAINT "AiTechnicianProfileServiceCategory_aiTechnicianId_fkey" FOREIGN KEY ("aiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTechnicianProfileServiceCategory" ADD CONSTRAINT "AiTechnicianProfileServiceCategory_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
