-- Phase 1 cattle fattening batches

CREATE TYPE "FatteningBatchStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "FatteningBatch" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" DATE,
    "targetDate" DATE,
    "status" "FatteningBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FatteningBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FatteningBatchAnimal" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "FatteningBatchAnimal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FatteningBatchAnimal_batchId_animalId_key" ON "FatteningBatchAnimal"("batchId", "animalId");
CREATE INDEX "FatteningBatchAnimal_batchId_idx" ON "FatteningBatchAnimal"("batchId");
CREATE INDEX "FatteningBatchAnimal_animalId_idx" ON "FatteningBatchAnimal"("animalId");
CREATE INDEX "FatteningBatch_customerId_farmId_status_idx" ON "FatteningBatch"("customerId", "farmId", "status");
CREATE INDEX "FatteningBatch_customerId_status_updatedAt_idx" ON "FatteningBatch"("customerId", "status", "updatedAt");

ALTER TABLE "FatteningBatch" ADD CONSTRAINT "FatteningBatch_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FatteningBatchAnimal" ADD CONSTRAINT "FatteningBatchAnimal_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FatteningBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FatteningBatchAnimal" ADD CONSTRAINT "FatteningBatchAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
