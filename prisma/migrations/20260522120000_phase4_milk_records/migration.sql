-- Phase 4 dairy: milk production records for mobile customers

CREATE TYPE "MilkSession" AS ENUM ('MORNING', 'EVENING');

CREATE TABLE "MilkRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "farmRef" TEXT,
    "recordedDate" DATE NOT NULL,
    "session" "MilkSession" NOT NULL,
    "quantityLiters" DECIMAL(10,3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MilkRecord_customerId_animalId_recordedDate_session_key" ON "MilkRecord"("customerId", "animalId", "recordedDate", "session");
CREATE INDEX "MilkRecord_customerId_recordedDate_idx" ON "MilkRecord"("customerId", "recordedDate");
CREATE INDEX "MilkRecord_animalId_idx" ON "MilkRecord"("animalId");

ALTER TABLE "MilkRecord" ADD CONSTRAINT "MilkRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilkRecord" ADD CONSTRAINT "MilkRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
