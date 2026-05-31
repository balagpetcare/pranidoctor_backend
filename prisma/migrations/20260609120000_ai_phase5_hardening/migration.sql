-- Phase 5 Hardening: admin analytics scope + reconciliation run audit trail

CREATE TABLE "admin_analytics_scopes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeLevel" VARCHAR(16) NOT NULL,
    "organizationId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_analytics_scopes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_analytics_scopes_userId_scopeLevel_organizationId_branchId_key" ON "admin_analytics_scopes"("userId", "scopeLevel", "organizationId", "branchId");
CREATE INDEX "admin_analytics_scopes_userId_enabled_idx" ON "admin_analytics_scopes"("userId", "enabled");

CREATE TABLE "ai_analytics_reconciliation_runs" (
    "id" TEXT NOT NULL,
    "runType" VARCHAR(32) NOT NULL,
    "bucketKey" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "logCount" INTEGER NOT NULL DEFAULT 0,
    "rollupsUpserted" INTEGER NOT NULL DEFAULT 0,
    "driftUsd" DECIMAL(12,6),
    "driftRequests" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "metadataJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_analytics_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_analytics_reconciliation_runs_runType_bucketKey_idx" ON "ai_analytics_reconciliation_runs"("runType", "bucketKey");
CREATE INDEX "ai_analytics_reconciliation_runs_status_startedAt_idx" ON "ai_analytics_reconciliation_runs"("status", "startedAt");
