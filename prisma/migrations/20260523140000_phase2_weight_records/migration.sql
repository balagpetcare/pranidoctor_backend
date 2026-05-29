-- Phase 2 fattening weight records

CREATE TABLE "WeightRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeightRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeightRecord_customerId_batchId_recordedAt_idx" ON "WeightRecord"("customerId", "batchId", "recordedAt");
CREATE INDEX "WeightRecord_animalId_batchId_recordedAt_idx" ON "WeightRecord"("animalId", "batchId", "recordedAt");

ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FatteningBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
