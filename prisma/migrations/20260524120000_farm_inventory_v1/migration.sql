-- Farm Inventory V1: catalog, balance, transaction ledger, audit, FeedRecord links.

CREATE TYPE "InventoryType" AS ENUM ('FEED', 'MEDICINE');

CREATE TYPE "MedicineUnit" AS ENUM (
  'TABLET',
  'CAPSULE',
  'ML',
  'LITER',
  'VIAL',
  'SACHET',
  'TUBE',
  'OTHER'
);

CREATE TYPE "InventoryTransactionType" AS ENUM (
  'RECEIPT',
  'CONSUMPTION',
  'ADJUSTMENT',
  'RESERVE',
  'RELEASE_RESERVE',
  'VOID'
);

CREATE TYPE "InventoryTransactionSourceType" AS ENUM (
  'MANUAL',
  'FEED_RECORD',
  'FARM_TREATMENT',
  'PRESCRIPTION_ITEM',
  'TREATMENT_CASE',
  'AI_PLAN'
);

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "farmRef" TEXT NOT NULL,
  "inventoryType" "InventoryType" NOT NULL,
  "displayName" TEXT NOT NULL,
  "feedType" "FeedType",
  "feedUnit" "FeedUnit",
  "medicineUnit" "MedicineUnit",
  "lowStockThreshold" DECIMAL(10,3),
  "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBalance" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantityOnHand" DECIMAL(12,3) NOT NULL,
  "quantityReserved" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryTransaction" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "farmRef" TEXT NOT NULL,
  "inventoryType" "InventoryType" NOT NULL,
  "transactionType" "InventoryTransactionType" NOT NULL,
  "quantityDelta" DECIMAL(12,3) NOT NULL,
  "unitSnapshot" TEXT NOT NULL,
  "sourceType" "InventoryTransactionSourceType" NOT NULL,
  "sourceId" TEXT,
  "idempotencyKey" TEXT,
  "reason" TEXT,
  "authorizedBy" TEXT,
  "voidsTransactionId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAuditLog" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FeedRecord" ADD COLUMN "inventoryItemId" TEXT;
ALTER TABLE "FeedRecord" ADD COLUMN "inventoryTransactionId" TEXT;
ALTER TABLE "FeedRecord" ADD COLUMN "deductStock" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "InventoryItem_customerId_farmRef_inventoryType_displayName_key"
  ON "InventoryItem"("customerId", "farmRef", "inventoryType", "displayName");

CREATE INDEX "InventoryItem_customerId_farmRef_inventoryType_isActive_idx"
  ON "InventoryItem"("customerId", "farmRef", "inventoryType", "isActive");

CREATE INDEX "InventoryItem_customerId_farmRef_deletedAt_idx"
  ON "InventoryItem"("customerId", "farmRef", "deletedAt");

CREATE UNIQUE INDEX "InventoryBalance_inventoryItemId_key"
  ON "InventoryBalance"("inventoryItemId");

CREATE UNIQUE INDEX "InventoryTransaction_customerId_idempotencyKey_key"
  ON "InventoryTransaction"("customerId", "idempotencyKey");

CREATE INDEX "InventoryTransaction_inventoryItemId_recordedAt_idx"
  ON "InventoryTransaction"("inventoryItemId", "recordedAt");

CREATE INDEX "InventoryTransaction_customerId_farmRef_inventoryType_idx"
  ON "InventoryTransaction"("customerId", "farmRef", "inventoryType");

CREATE INDEX "InventoryTransaction_sourceType_sourceId_idx"
  ON "InventoryTransaction"("sourceType", "sourceId");

CREATE INDEX "InventoryAuditLog_customerId_createdAt_idx"
  ON "InventoryAuditLog"("customerId", "createdAt");

CREATE INDEX "InventoryAuditLog_inventoryItemId_createdAt_idx"
  ON "InventoryAuditLog"("inventoryItemId", "createdAt");

CREATE UNIQUE INDEX "FeedRecord_inventoryTransactionId_key"
  ON "FeedRecord"("inventoryTransactionId");

CREATE INDEX "FeedRecord_inventoryItemId_idx"
  ON "FeedRecord"("inventoryItemId");

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAuditLog"
  ADD CONSTRAINT "InventoryAuditLog_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAuditLog"
  ADD CONSTRAINT "InventoryAuditLog_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedRecord"
  ADD CONSTRAINT "FeedRecord_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedRecord"
  ADD CONSTRAINT "FeedRecord_inventoryTransactionId_fkey"
  FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
