-- B1 token tracking: totalTokens, billable, user/tenant daily rollups

ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "billable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "rateVersion" VARCHAR(32);

UPDATE "AiUsageRecord"
SET "totalTokens" = "inputTokens" + "outputTokens"
WHERE "totalTokens" = 0;

UPDATE "AiUsageRecord"
SET "billable" = ("success" = true AND provider IN ('openai', 'anthropic'))
WHERE "billable" = false AND "success" = true;

CREATE INDEX IF NOT EXISTS "AiUsageRecord_userId_createdAt_idx"
  ON "AiUsageRecord"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiUsageRecord_customerId_createdAt_idx"
  ON "AiUsageRecord"("customerId", "createdAt");

ALTER TABLE "AiUsageDailyRollup" ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiUsageDailyRollup" ADD COLUMN IF NOT EXISTS "billableTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiUsageDailyRollup" ADD COLUMN IF NOT EXISTS "billableCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0;

UPDATE "AiUsageDailyRollup"
SET "totalTokens" = "inputTokens" + "outputTokens"
WHERE "totalTokens" = 0;

CREATE TABLE IF NOT EXISTS "AiUsageUserDailyRollup" (
    "id" TEXT NOT NULL,
    "bucketDate" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "billableTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "billableCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsageUserDailyRollup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageUserDailyRollup_bucketDate_userId_feature_provider_model_key"
  ON "AiUsageUserDailyRollup"("bucketDate", "userId", "feature", "provider", "model");

CREATE INDEX IF NOT EXISTS "AiUsageUserDailyRollup_userId_bucketDate_idx"
  ON "AiUsageUserDailyRollup"("userId", "bucketDate");

CREATE TABLE IF NOT EXISTS "AiUsageCustomerDailyRollup" (
    "id" TEXT NOT NULL,
    "bucketDate" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "billableTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "billableCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsageCustomerDailyRollup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageCustomerDailyRollup_bucketDate_customerId_feature_provider_model_key"
  ON "AiUsageCustomerDailyRollup"("bucketDate", "customerId", "feature", "provider", "model");

CREATE INDEX IF NOT EXISTS "AiUsageCustomerDailyRollup_customerId_bucketDate_idx"
  ON "AiUsageCustomerDailyRollup"("customerId", "bucketDate");
