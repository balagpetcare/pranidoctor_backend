-- Phase 3 batch feeding: BatchFeedPlan + FeedRecord.fatteningBatchId FK

CREATE TYPE "BatchFeedPlanMode" AS ENUM ('NORMAL', 'FATTENING');

CREATE TABLE "BatchFeedPlan" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "mode" "BatchFeedPlanMode" NOT NULL DEFAULT 'FATTENING',
    "dailyAmountKg" DECIMAL(10,3),
    "dailyCostBdt" DECIMAL(12,2),
    "feedType" "FeedType",
    "unit" "FeedUnit" DEFAULT 'KG',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchFeedPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BatchFeedPlan_batchId_key" ON "BatchFeedPlan"("batchId");
CREATE INDEX "BatchFeedPlan_customerId_idx" ON "BatchFeedPlan"("customerId");

ALTER TABLE "BatchFeedPlan" ADD CONSTRAINT "BatchFeedPlan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchFeedPlan" ADD CONSTRAINT "BatchFeedPlan_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FatteningBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedRecord" ADD COLUMN "fatteningBatchId" TEXT;

CREATE INDEX "FeedRecord_fatteningBatchId_recordedDate_idx" ON "FeedRecord"("fatteningBatchId", "recordedDate");

ALTER TABLE "FeedRecord" ADD CONSTRAINT "FeedRecord_fatteningBatchId_fkey" FOREIGN KEY ("fatteningBatchId") REFERENCES "FatteningBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
