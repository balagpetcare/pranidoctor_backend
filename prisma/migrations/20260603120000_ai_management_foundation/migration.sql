-- AIMS — AI Management System database foundation
-- Models: AiProvider, AiModel, AiApiKey, AiRoute, AiPrompt, AiUsageLog, AiFailoverRule, AiSettings

-- CreateEnum
CREATE TYPE "AiApiKeyStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiFailoverTriggerType" AS ENUM ('HTTP_5XX', 'HTTP_429', 'TIMEOUT', 'RATE_LIMIT', 'BUDGET_EXCEEDED', 'HEALTH_SCORE_LOW', 'CONTENT_POLICY', 'PROVIDER_DISABLED');

-- CreateEnum
CREATE TYPE "AiFailoverActionType" AS ENUM ('NEXT_PROVIDER', 'DOWNGRADE_MODEL', 'RULES_ONLY', 'RETRY_SAME', 'ABORT');

-- CreateEnum
CREATE TYPE "AiSettingsCategory" AS ENUM ('ROUTING', 'BUDGET', 'SECURITY', 'GOVERNANCE', 'FEATURE_FLAGS', 'ENCRYPTION');

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'platform',
    "tenantId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "providerKey" VARCHAR(32) NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "adapterType" VARCHAR(32) NOT NULL DEFAULT 'openai_compatible',
    "baseUrl" TEXT,
    "capabilitiesJson" JSONB NOT NULL DEFAULT '[]',
    "configJson" JSONB,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastHealthCheckAt" TIMESTAMP(3),
    "costTier" VARCHAR(16) NOT NULL DEFAULT 'standard',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'platform',
    "tenantId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "providerId" TEXT NOT NULL,
    "modelKey" VARCHAR(128) NOT NULL,
    "displayName" TEXT NOT NULL,
    "modelType" VARCHAR(32) NOT NULL DEFAULT 'chat',
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "inputCostPerToken" DECIMAL(16,12) NOT NULL DEFAULT 0,
    "outputCostPerToken" DECIMAL(16,12) NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "capabilitiesJson" JSONB NOT NULL DEFAULT '[]',
    "metadataJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_api_keys" (
    "id" TEXT NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'platform',
    "tenantId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AiApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "encryptedSecret" TEXT NOT NULL,
    "encryptionKeyId" VARCHAR(64) NOT NULL DEFAULT 'env:v1',
    "encryptionAlgorithm" VARCHAR(32) NOT NULL DEFAULT 'aes-256-gcm',
    "secretHint" VARCHAR(16),
    "expiresAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_routes" (
    "id" TEXT NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'platform',
    "tenantId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "routeKey" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "taskType" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditionsJson" JSONB,
    "primaryProviderId" TEXT,
    "primaryModelId" TEXT,
    "providerChainJson" JSONB NOT NULL DEFAULT '[]',
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "asyncRequired" BOOLEAN NOT NULL DEFAULT false,
    "maxCostUsd" DECIMAL(10,6),
    "fallbackToRules" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompts" (
    "id" TEXT NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'platform',
    "tenantId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "promptKey" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "taskType" VARCHAR(64),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemBn" TEXT NOT NULL,
    "systemEn" TEXT NOT NULL,
    "userTemplateBn" TEXT,
    "userTemplateEn" TEXT,
    "status" "AiPromptStatus" NOT NULL DEFAULT 'DRAFT',
    "trafficPercent" INTEGER NOT NULL DEFAULT 100,
    "parentVersionId" TEXT,
    "variablesSchemaJson" JSONB,
    "testCasesJson" JSONB,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'platform',
    "tenantId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "organizationId" VARCHAR(64),
    "userId" TEXT,
    "customerId" TEXT,
    "providerId" TEXT,
    "modelId" TEXT,
    "routeId" TEXT,
    "promptId" TEXT,
    "failoverRuleId" TEXT,
    "taskType" VARCHAR(64) NOT NULL,
    "feature" VARCHAR(64),
    "providerKey" VARCHAR(32) NOT NULL,
    "modelKey" VARCHAR(128) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6),
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "rateVersion" VARCHAR(32),
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" VARCHAR(64),
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "fromProviderKey" VARCHAR(32),
    "requestId" VARCHAR(64),
    "correlationId" VARCHAR(64),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_failover_rules" (
    "id" TEXT NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'platform',
    "tenantId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "routeId" TEXT,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "triggerType" "AiFailoverTriggerType" NOT NULL,
    "triggerConfigJson" JSONB,
    "fromProviderId" TEXT,
    "toProviderId" TEXT,
    "fromModelId" TEXT,
    "toModelId" TEXT,
    "action" "AiFailoverActionType" NOT NULL,
    "actionConfigJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_failover_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL,
    "tenantId" VARCHAR(64),
    "branchId" VARCHAR(64),
    "settingsKey" VARCHAR(64) NOT NULL,
    "category" "AiSettingsCategory" NOT NULL DEFAULT 'ROUTING',
    "settingsJson" JSONB NOT NULL DEFAULT '{}',
    "encryptedSettings" TEXT,
    "encryptionKeyId" VARCHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_providers_tenantId_branchId_idx" ON "ai_providers"("tenantId", "branchId");
CREATE INDEX "ai_providers_enabled_deletedAt_idx" ON "ai_providers"("enabled", "deletedAt");
CREATE INDEX "ai_providers_deletedAt_idx" ON "ai_providers"("deletedAt");
CREATE INDEX "ai_providers_scopeKey_providerKey_idx" ON "ai_providers"("scopeKey", "providerKey");

CREATE INDEX "ai_models_providerId_enabled_idx" ON "ai_models"("providerId", "enabled");
CREATE INDEX "ai_models_deletedAt_idx" ON "ai_models"("deletedAt");
CREATE UNIQUE INDEX "ai_models_scopeKey_providerId_modelKey_key" ON "ai_models"("scopeKey", "providerId", "modelKey");

CREATE INDEX "ai_api_keys_providerId_status_idx" ON "ai_api_keys"("providerId", "status");
CREATE INDEX "ai_api_keys_scopeKey_providerId_idx" ON "ai_api_keys"("scopeKey", "providerId");
CREATE INDEX "ai_api_keys_deletedAt_idx" ON "ai_api_keys"("deletedAt");

CREATE INDEX "ai_routes_taskType_enabled_priority_idx" ON "ai_routes"("taskType", "enabled", "priority");
CREATE INDEX "ai_routes_tenantId_branchId_idx" ON "ai_routes"("tenantId", "branchId");
CREATE INDEX "ai_routes_deletedAt_idx" ON "ai_routes"("deletedAt");
CREATE INDEX "ai_routes_scopeKey_routeKey_idx" ON "ai_routes"("scopeKey", "routeKey");

CREATE INDEX "ai_prompts_scopeKey_promptKey_status_idx" ON "ai_prompts"("scopeKey", "promptKey", "status");
CREATE INDEX "ai_prompts_taskType_status_idx" ON "ai_prompts"("taskType", "status");
CREATE INDEX "ai_prompts_deletedAt_idx" ON "ai_prompts"("deletedAt");
CREATE UNIQUE INDEX "ai_prompts_scopeKey_promptKey_version_key" ON "ai_prompts"("scopeKey", "promptKey", "version");

CREATE INDEX "ai_usage_logs_createdAt_taskType_idx" ON "ai_usage_logs"("createdAt", "taskType");
CREATE INDEX "ai_usage_logs_tenantId_branchId_createdAt_idx" ON "ai_usage_logs"("tenantId", "branchId", "createdAt");
CREATE INDEX "ai_usage_logs_organizationId_createdAt_idx" ON "ai_usage_logs"("organizationId", "createdAt");
CREATE INDEX "ai_usage_logs_userId_createdAt_idx" ON "ai_usage_logs"("userId", "createdAt");
CREATE INDEX "ai_usage_logs_providerId_createdAt_idx" ON "ai_usage_logs"("providerId", "createdAt");
CREATE INDEX "ai_usage_logs_routeId_createdAt_idx" ON "ai_usage_logs"("routeId", "createdAt");

CREATE INDEX "ai_failover_rules_routeId_enabled_priority_idx" ON "ai_failover_rules"("routeId", "enabled", "priority");
CREATE INDEX "ai_failover_rules_scopeKey_enabled_idx" ON "ai_failover_rules"("scopeKey", "enabled");
CREATE INDEX "ai_failover_rules_deletedAt_idx" ON "ai_failover_rules"("deletedAt");

CREATE INDEX "ai_settings_tenantId_branchId_idx" ON "ai_settings"("tenantId", "branchId");
CREATE INDEX "ai_settings_category_idx" ON "ai_settings"("category");
CREATE INDEX "ai_settings_deletedAt_idx" ON "ai_settings"("deletedAt");
CREATE INDEX "ai_settings_scopeKey_settingsKey_idx" ON "ai_settings"("scopeKey", "settingsKey");

-- Partial unique indexes: active (non-deleted) rows only
CREATE UNIQUE INDEX "ai_providers_scopeKey_providerKey_active_key"
  ON "ai_providers"("scopeKey", "providerKey") WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "ai_routes_scopeKey_routeKey_active_key"
  ON "ai_routes"("scopeKey", "routeKey") WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "ai_settings_scopeKey_settingsKey_active_key"
  ON "ai_settings"("scopeKey", "settingsKey") WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_api_keys" ADD CONSTRAINT "ai_api_keys_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_routes" ADD CONSTRAINT "ai_routes_primaryProviderId_fkey" FOREIGN KEY ("primaryProviderId") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_routes" ADD CONSTRAINT "ai_routes_primaryModelId_fkey" FOREIGN KEY ("primaryModelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ai_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ai_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_failoverRuleId_fkey" FOREIGN KEY ("failoverRuleId") REFERENCES "ai_failover_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_failover_rules" ADD CONSTRAINT "ai_failover_rules_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ai_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_failover_rules" ADD CONSTRAINT "ai_failover_rules_fromProviderId_fkey" FOREIGN KEY ("fromProviderId") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_failover_rules" ADD CONSTRAINT "ai_failover_rules_toProviderId_fkey" FOREIGN KEY ("toProviderId") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_failover_rules" ADD CONSTRAINT "ai_failover_rules_fromModelId_fkey" FOREIGN KEY ("fromModelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_failover_rules" ADD CONSTRAINT "ai_failover_rules_toModelId_fkey" FOREIGN KEY ("toModelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
