-- A-03b / DB repair: create missing tables and columns from schema.prisma (idempotent)

DO $$ BEGIN
  CREATE TYPE "LeadActivityType" AS ENUM ('CREATED', 'CALLED', 'MESSAGED', 'STATUS_CHANGED', 'ASSIGNED', 'NOTE_ADDED', 'CONVERTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadSource" AS ENUM ('AI_CHAT', 'PHONE', 'WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'WALK_IN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONSULTATION_SCHEDULED', 'CONVERTED', 'LOST', 'FOLLOW_UP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OfflineConflictStrategy" AS ENUM ('SERVER_WINS', 'LOCAL_WINS', 'MERGE_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OfflineConnectivityMode" AS ENUM ('ONLINE', 'DEGRADED', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OfflineLeadQueueStatus" AS ENUM ('QUEUED', 'UPLOADING', 'SYNCED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OfflineSyncEntityType" AS ENUM ('AUTH_SNAPSHOT', 'AREA_DATA', 'CASE_DRAFT', 'VOICE_DRAFT', 'PROFILE', 'OFFLINE_LEAD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OfflineSyncItemStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'DEAD', 'CONFLICT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OfflineSyncOperation" AS ENUM ('UPSERT', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceRequestEventType" AS ENUM ('CREATED', 'ASSIGNED', 'REASSIGNED', 'ACCEPTED', 'REJECTED', 'STARTED', 'NOTE_ADDED', 'CASE_OPENED', 'CASE_UPDATED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER', 'DOCTOR', 'AI_TECHNICIAN', 'SUPPORT', 'SUPER_ADMIN', 'HEALTH_WORKER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Lead" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
  "assignedAdminId" TEXT,
  "animalType" TEXT,
  "concern" TEXT,
  "notes" TEXT,
  "villageId" TEXT,
  "convertedUserId" TEXT,
  "serviceRequestId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "LeadActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "activityType" "LeadActivityType" NOT NULL,
  "description" TEXT NOT NULL,
  "performedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "OfflineSyncSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT,
  "connectivityMode" "OfflineConnectivityMode" NOT NULL DEFAULT 'ONLINE',
  "manualOverride" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastSyncAt" TIMESTAMP(3),
  "lastClientSnapshotAt" TIMESTAMP(3),
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "deadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "OfflineSyncItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "entityType" "OfflineSyncEntityType" NOT NULL,
  "operation" "OfflineSyncOperation" NOT NULL DEFAULT 'UPSERT',
  "payloadHash" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "conflictStrategy" "OfflineConflictStrategy" NOT NULL,
  "status" "OfflineSyncItemStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lastError" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "clientSequence" INTEGER NOT NULL,
  "batchId" TEXT,
  "serverEntityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "OfflineLeadDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "syncItemId" TEXT,
  "clientLeadId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "concern" TEXT,
  "animalType" TEXT,
  "villageId" TEXT,
  "mediaMetadataJson" JSONB,
  "status" "OfflineLeadQueueStatus" NOT NULL DEFAULT 'QUEUED',
  "serverLeadId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "OfflineConflictRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "syncItemId" TEXT NOT NULL,
  "entityType" "OfflineSyncEntityType" NOT NULL,
  "entityId" TEXT,
  "resolution" "OfflineConflictStrategy" NOT NULL,
  "serverVersion" TEXT,
  "clientVersion" TEXT,
  "mergePayloadJson" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "ServiceRequestTimelineEvent" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "eventType" "ServiceRequestEventType" NOT NULL,
  "actorUserId" TEXT,
  "actorRole" "UserRole",
  "note" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AiUsageDailyRollup" (
  "id" TEXT NOT NULL,
  "bucketDate" TIMESTAMP(3) NOT NULL,
  "feature" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "billableTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "billableCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "latencyMsSum" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AiUsageUserDailyRollup" (
  "id" TEXT NOT NULL,
  "bucketDate" TIMESTAMP(3) NOT NULL,
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
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AiUsageCustomerDailyRollup" (
  "id" TEXT NOT NULL,
  "bucketDate" TIMESTAMP(3) NOT NULL,
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
  PRIMARY KEY ("id")
);
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "primaryVillageId" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMP(3);
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "adminNote" TEXT;
ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
ALTER TABLE "AiKnowledgeEmbeddingChunk" ADD COLUMN IF NOT EXISTS "metadataSidecarJson" JSONB;
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER DEFAULT 0;
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "billable" BOOLEAN DEFAULT FALSE;
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "rateVersion" VARCHAR(32);
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "errorCode" VARCHAR(64);
ALTER TABLE "AiUsageRecord" ADD COLUMN IF NOT EXISTS "isFallback" BOOLEAN DEFAULT FALSE;
ALTER TABLE "ai_usage_logs" ADD COLUMN IF NOT EXISTS "retrievalMetadataJson" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_serviceRequestId_key" ON "Lead"("serviceRequestId");
CREATE INDEX IF NOT EXISTS "Lead_phone_idx" ON "Lead"("phone");
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");
CREATE INDEX IF NOT EXISTS "Lead_assignedAdminId_idx" ON "Lead"("assignedAdminId");
CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE UNIQUE INDEX IF NOT EXISTS "OfflineSyncSession_userId_deviceId_key" ON "OfflineSyncSession"("userId", "deviceId");
CREATE INDEX IF NOT EXISTS "OfflineSyncSession_userId_idx" ON "OfflineSyncSession"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "OfflineSyncItem_userId_idempotencyKey_key" ON "OfflineSyncItem"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "OfflineSyncItem_userId_status_idx" ON "OfflineSyncItem"("userId", "status");
CREATE INDEX IF NOT EXISTS "OfflineSyncItem_userId_clientSequence_idx" ON "OfflineSyncItem"("userId", "clientSequence");
CREATE INDEX IF NOT EXISTS "OfflineSyncItem_nextRetryAt_idx" ON "OfflineSyncItem"("nextRetryAt");
CREATE INDEX IF NOT EXISTS "OfflineSyncItem_sessionId_idx" ON "OfflineSyncItem"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "OfflineLeadDraft_userId_clientLeadId_key" ON "OfflineLeadDraft"("userId", "clientLeadId");
CREATE INDEX IF NOT EXISTS "OfflineLeadDraft_userId_status_idx" ON "OfflineLeadDraft"("userId", "status");
CREATE INDEX IF NOT EXISTS "OfflineLeadDraft_syncItemId_idx" ON "OfflineLeadDraft"("syncItemId");
CREATE INDEX IF NOT EXISTS "OfflineConflictRecord_userId_idx" ON "OfflineConflictRecord"("userId");
CREATE INDEX IF NOT EXISTS "OfflineConflictRecord_syncItemId_idx" ON "OfflineConflictRecord"("syncItemId");
CREATE INDEX IF NOT EXISTS "ServiceRequestTimelineEvent_serviceRequestId_createdAt_idx" ON "ServiceRequestTimelineEvent"("serviceRequestId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageDailyRollup_bucketDate_feature_provider_model_key" ON "AiUsageDailyRollup"("bucketDate", "feature", "provider", "model");
CREATE INDEX IF NOT EXISTS "AiUsageDailyRollup_bucketDate_idx" ON "AiUsageDailyRollup"("bucketDate");
CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageUserDailyRollup_bucketDate_userId_feature_provider_model_key" ON "AiUsageUserDailyRollup"("bucketDate", "userId", "feature", "provider", "model");
CREATE INDEX IF NOT EXISTS "AiUsageUserDailyRollup_userId_bucketDate_idx" ON "AiUsageUserDailyRollup"("userId", "bucketDate");
CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageCustomerDailyRollup_bucketDate_customerId_feature_provider_model_key" ON "AiUsageCustomerDailyRollup"("bucketDate", "customerId", "feature", "provider", "model");
CREATE INDEX IF NOT EXISTS "AiUsageCustomerDailyRollup_customerId_bucketDate_idx" ON "AiUsageCustomerDailyRollup"("customerId", "bucketDate");
CREATE INDEX IF NOT EXISTS "CustomerProfile_primaryVillageId_idx" ON "CustomerProfile"("primaryVillageId");
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRequest_leadId_key" ON "ServiceRequest"("leadId");

DO $$ BEGIN
  ALTER TABLE "ServiceRequestTimelineEvent" ADD CONSTRAINT "ServiceRequestTimelineEvent_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_primaryVillageId_fkey" FOREIGN KEY ("primaryVillageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OfflineSyncSession" ADD CONSTRAINT "OfflineSyncSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OfflineLeadDraft" ADD CONSTRAINT "OfflineLeadDraft_serverLeadId_fkey" FOREIGN KEY ("serverLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OfflineLeadDraft" ADD CONSTRAINT "OfflineLeadDraft_syncItemId_fkey" FOREIGN KEY ("syncItemId") REFERENCES "OfflineSyncItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OfflineLeadDraft" ADD CONSTRAINT "OfflineLeadDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AnimalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedAiTechnicianId_fkey" FOREIGN KEY ("assignedAiTechnicianId") REFERENCES "AiTechnicianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OfflineSyncItem" ADD CONSTRAINT "OfflineSyncItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OfflineSyncSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OfflineSyncItem" ADD CONSTRAINT "OfflineSyncItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ai_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ai_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_failoverRuleId_fkey" FOREIGN KEY ("failoverRuleId") REFERENCES "ai_failover_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AiKnowledgeEmbeddingChunk" ADD CONSTRAINT "AiKnowledgeEmbeddingChunk_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OfflineConflictRecord" ADD CONSTRAINT "OfflineConflictRecord_syncItemId_fkey" FOREIGN KEY ("syncItemId") REFERENCES "OfflineSyncItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OfflineConflictRecord" ADD CONSTRAINT "OfflineConflictRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

