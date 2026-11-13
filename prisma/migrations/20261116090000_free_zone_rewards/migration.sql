-- Free Zone: admin-managed reward periods, winners, appeals, and customer reviews.
CREATE TABLE "FreeZoneRewardPeriod" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "topN" INTEGER NOT NULL DEFAULT 3,
  "minPoints" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "note" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "FreeZoneRewardPeriod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FreeZoneRewardPeriod_status_endsAt_idx" ON "FreeZoneRewardPeriod"("status", "endsAt");

CREATE TABLE "FreeZoneRewardPrize" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" VARCHAR(300),
  CONSTRAINT "FreeZoneRewardPrize_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FreeZoneRewardPrize_periodId_rank_key" ON "FreeZoneRewardPrize"("periodId", "rank");
ALTER TABLE "FreeZoneRewardPrize" ADD CONSTRAINT "FreeZoneRewardPrize_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FreeZoneRewardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FreeZoneRewardWinner" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "prizeTitle" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "adminNote" VARCHAR(300),
  "awardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FreeZoneRewardWinner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FreeZoneRewardWinner_periodId_userId_key" ON "FreeZoneRewardWinner"("periodId", "userId");
CREATE INDEX "FreeZoneRewardWinner_userId_idx" ON "FreeZoneRewardWinner"("userId");
ALTER TABLE "FreeZoneRewardWinner" ADD CONSTRAINT "FreeZoneRewardWinner_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FreeZoneRewardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FreeZoneRewardAppeal" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "note" VARCHAR(1000) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "adminNote" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FreeZoneRewardAppeal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FreeZoneRewardAppeal_periodId_userId_key" ON "FreeZoneRewardAppeal"("periodId", "userId");
ALTER TABLE "FreeZoneRewardAppeal" ADD CONSTRAINT "FreeZoneRewardAppeal_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FreeZoneRewardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FreeZoneReview" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "doctorUserId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(1000),
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FreeZoneReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FreeZoneReview_requestId_key" ON "FreeZoneReview"("requestId");
CREATE INDEX "FreeZoneReview_doctorUserId_status_idx" ON "FreeZoneReview"("doctorUserId", "status");
