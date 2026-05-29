-- Phase 4: batch ROI settings + finance batch link

CREATE TABLE "FatteningBatchRoi" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "purchaseCostBdt" DECIMAL(12,2),
    "projectedSaleBdt" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FatteningBatchRoi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FatteningBatchRoi_batchId_key" ON "FatteningBatchRoi"("batchId");
CREATE INDEX "FatteningBatchRoi_customerId_idx" ON "FatteningBatchRoi"("customerId");

ALTER TABLE "FatteningBatchRoi" ADD CONSTRAINT "FatteningBatchRoi_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FatteningBatchRoi" ADD CONSTRAINT "FatteningBatchRoi_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FatteningBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceRecord" ADD COLUMN "fatteningBatchId" TEXT;

CREATE INDEX "FinanceRecord_fatteningBatchId_recordedDate_idx" ON "FinanceRecord"("fatteningBatchId", "recordedDate");

ALTER TABLE "FinanceRecord" ADD CONSTRAINT "FinanceRecord_fatteningBatchId_fkey" FOREIGN KEY ("fatteningBatchId") REFERENCES "FatteningBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
