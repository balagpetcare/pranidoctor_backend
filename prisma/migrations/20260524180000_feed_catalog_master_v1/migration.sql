-- Feed catalog master (Bangladesh cattle feeds) — additive only.
CREATE TYPE "FeedCategory" AS ENUM (
  'ROUGHAGE',
  'GREEN',
  'CONCENTRATE',
  'SUPPLEMENT',
  'MINERAL',
  'SILAGE',
  'CUSTOM'
);

CREATE TABLE "FeedCatalog" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameBn" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "category" "FeedCategory" NOT NULL,
  "defaultUnit" "FeedUnit" NOT NULL,
  "approxPriceBdt" DECIMAL(12,2),
  "nutritionJson" JSONB,
  "availabilityScore" INTEGER,
  "isSeeded" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeedCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeedCatalog_code_key" ON "FeedCatalog"("code");
CREATE INDEX "FeedCatalog_category_isActive_idx" ON "FeedCatalog"("category", "isActive");
CREATE INDEX "FeedCatalog_isActive_sortOrder_idx" ON "FeedCatalog"("isActive", "sortOrder");

ALTER TABLE "InventoryItem" ADD COLUMN "feedCatalogId" TEXT;
CREATE INDEX "InventoryItem_feedCatalogId_idx" ON "InventoryItem"("feedCatalogId");
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_feedCatalogId_fkey"
  FOREIGN KEY ("feedCatalogId") REFERENCES "FeedCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
