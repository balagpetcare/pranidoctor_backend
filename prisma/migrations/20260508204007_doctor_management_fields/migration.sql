-- AlterTable
ALTER TABLE "DoctorProfile" ADD COLUMN     "acceptsEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acceptsOnlineConsultation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "degree" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "experienceYears" INTEGER,
ADD COLUMN     "profilePhotoUrl" TEXT,
ADD COLUMN     "visitFeeBdt" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "DoctorProfileArea" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorProfileArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfileServiceCategory" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorProfileServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorProfileArea_areaId_idx" ON "DoctorProfileArea"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfileArea_doctorId_areaId_key" ON "DoctorProfileArea"("doctorId", "areaId");

-- CreateIndex
CREATE INDEX "DoctorProfileServiceCategory_serviceCategoryId_idx" ON "DoctorProfileServiceCategory"("serviceCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfileServiceCategory_doctorId_serviceCategoryId_key" ON "DoctorProfileServiceCategory"("doctorId", "serviceCategoryId");

-- AddForeignKey
ALTER TABLE "DoctorProfileArea" ADD CONSTRAINT "DoctorProfileArea_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfileArea" ADD CONSTRAINT "DoctorProfileArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfileServiceCategory" ADD CONSTRAINT "DoctorProfileServiceCategory_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfileServiceCategory" ADD CONSTRAINT "DoctorProfileServiceCategory_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
