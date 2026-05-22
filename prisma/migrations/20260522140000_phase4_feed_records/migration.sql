-- Phase 4 feed management records

CREATE TYPE "FeedType" AS ENUM ('GRASS', 'STRAW', 'CONCENTRATE', 'MINERAL', 'SILAGE', 'OTHER');
CREATE TYPE "FeedUnit" AS ENUM ('KG', 'BAG', 'BUNDLE', 'LITER', 'OTHER');

CREATE TABLE "FeedRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "farmRef" TEXT,
    "animalId" TEXT,
    "batchId" TEXT,
    "batchName" TEXT,
    "feedType" "FeedType" NOT NULL,
    "amount" DECIMAL(10,3) NOT NULL,
    "unit" "FeedUnit" NOT NULL,
    "costBdt" DECIMAL(12,2),
    "recordedDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedRecord_customerId_recordedDate_idx" ON "FeedRecord"("customerId", "recordedDate");
CREATE INDEX "FeedRecord_animalId_idx" ON "FeedRecord"("animalId");
CREATE INDEX "FeedRecord_feedType_idx" ON "FeedRecord"("feedType");

ALTER TABLE "FeedRecord" ADD CONSTRAINT "FeedRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedRecord" ADD CONSTRAINT "FeedRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
