-- AI production platform: monthly rollups, provider health, alerts, usage dimensions

ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "organizationId" VARCHAR(64);
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(64);
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "clinicId" VARCHAR(64);
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "doctorId" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "AiUsageRecord_doctorId_createdAt_idx" ON "AiUsageRecord"("doctorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageRecord_organizationId_createdAt_idx" ON "AiUsageRecord"("organizationId", "createdAt");

CREATE TABLE IF NOT EXISTS "AiUsageMonthlyRollup" (
    "id" TEXT NOT NULL,
    "bucketMonth" DATE NOT NULL,
    "dimensionType" VARCHAR(32) NOT NULL,
    "dimensionId" VARCHAR(64),
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "latencyMsSum" INTEGER NOT NULL DEFAULT 0,
    "timeoutCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsageMonthlyRollup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageMonthlyRollup_bucketMonth_dimensionType_dimensionId_provider_model_key"
ON "AiUsageMonthlyRollup"("bucketMonth", "dimensionType", "dimensionId", "provider", "model");

CREATE INDEX IF NOT EXISTS "AiUsageMonthlyRollup_bucketMonth_dimensionType_idx"
ON "AiUsageMonthlyRollup"("bucketMonth", "dimensionType");

CREATE INDEX IF NOT EXISTS "AiUsageMonthlyRollup_dimensionType_dimensionId_bucketMonth_idx"
ON "AiUsageMonthlyRollup"("dimensionType", "dimensionId", "bucketMonth");

CREATE TABLE IF NOT EXISTS "AiProviderHealthSnapshot" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reachable" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "errorCode" VARCHAR(64),
    "probedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiProviderHealthSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiProviderHealthSnapshot_provider_probedAt_idx"
ON "AiProviderHealthSnapshot"("provider", "probedAt");

CREATE TABLE IF NOT EXISTS "AiUsageAlert" (
    "id" TEXT NOT NULL,
    "alertType" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "metadataJson" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiUsageAlert_alertType_createdAt_idx"
ON "AiUsageAlert"("alertType", "createdAt");

CREATE INDEX IF NOT EXISTS "AiUsageAlert_acknowledged_createdAt_idx"
ON "AiUsageAlert"("acknowledged", "createdAt");
