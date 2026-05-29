-- AI usage monitoring: failure tracking, daily rollups

ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "errorCode" VARCHAR(64);
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "isFallback" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "AiUsageRecord_createdAt_provider_success_idx"
  ON "AiUsageRecord"("createdAt", "provider", "success");

CREATE TABLE IF NOT EXISTS "AiUsageDailyRollup" (
    "id" TEXT NOT NULL,
    "bucketDate" DATE NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "latencyMsSum" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsageDailyRollup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageDailyRollup_bucketDate_feature_provider_model_key"
  ON "AiUsageDailyRollup"("bucketDate", "feature", "provider", "model");

CREATE INDEX IF NOT EXISTS "AiUsageDailyRollup_bucketDate_idx"
  ON "AiUsageDailyRollup"("bucketDate");
