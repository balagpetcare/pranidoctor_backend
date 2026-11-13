-- Free Zone core: FREE_CONSULTATION request type, doctor free slots, append-only points ledger.
ALTER TYPE "ServiceRequestType" ADD VALUE IF NOT EXISTS 'FREE_CONSULTATION';

CREATE TABLE "PartnerFreeSlot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "mode" TEXT NOT NULL DEFAULT 'TEXT',
  "animalTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "note" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerFreeSlot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerFreeSlot_userId_startsAt_idx" ON "PartnerFreeSlot"("userId", "startsAt");
CREATE INDEX "PartnerFreeSlot_startsAt_idx" ON "PartnerFreeSlot"("startsAt");

CREATE TABLE "PointLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PointLedger_userId_eventType_refId_key" ON "PointLedger"("userId", "eventType", "refId");
CREATE INDEX "PointLedger_userId_createdAt_idx" ON "PointLedger"("userId", "createdAt");
CREATE INDEX "PointLedger_createdAt_idx" ON "PointLedger"("createdAt");
