-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('UNKNOWN', 'NOT_APPLICABLE', 'NOT_PREGNANT', 'PREGNANT');

-- AlterTable
ALTER TABLE "AnimalProfile" ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "pregnancyStatus" "PregnancyStatus";
