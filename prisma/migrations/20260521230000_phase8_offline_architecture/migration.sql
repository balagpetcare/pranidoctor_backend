-- P8 — Offline architecture (sync queue, retry, offline lead drafts)

CREATE TYPE "OfflineConnectivityMode" AS ENUM ('ONLINE', 'DEGRADED', 'OFFLINE');
CREATE TYPE "OfflineSyncEntityType" AS ENUM ('AUTH_SNAPSHOT', 'AREA_DATA', 'CASE_DRAFT', 'VOICE_DRAFT', 'PROFILE', 'OFFLINE_LEAD');
CREATE TYPE "OfflineSyncOperation" AS ENUM ('UPSERT', 'DELETE');
CREATE TYPE "OfflineConflictStrategy" AS ENUM ('SERVER_WINS', 'LOCAL_WINS', 'MERGE_REQUIRED');
CREATE TYPE "OfflineSyncItemStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'DEAD', 'CONFLICT');
CREATE TYPE "OfflineLeadQueueStatus" AS ENUM ('QUEUED', 'UPLOADING', 'SYNCED', 'FAILED');

CREATE TABLE "OfflineSyncSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT,
  "connectivityMode" "OfflineConnectivityMode" NOT NULL DEFAULT 'ONLINE',
  "manualOverride" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncAt" TIMESTAMP(3),
  "lastClientSnapshotAt" TIMESTAMP(3),
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "deadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfflineSyncSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfflineSyncItem" (
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfflineSyncItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfflineLeadDraft" (
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfflineLeadDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfflineConflictRecord" (
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfflineConflictRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfflineSyncSession_userId_deviceId_key" ON "OfflineSyncSession"("userId", "deviceId");
CREATE INDEX "OfflineSyncSession_userId_idx" ON "OfflineSyncSession"("userId");
CREATE UNIQUE INDEX "OfflineSyncItem_userId_idempotencyKey_key" ON "OfflineSyncItem"("userId", "idempotencyKey");
CREATE INDEX "OfflineSyncItem_userId_status_idx" ON "OfflineSyncItem"("userId", "status");
CREATE INDEX "OfflineSyncItem_userId_clientSequence_idx" ON "OfflineSyncItem"("userId", "clientSequence");
CREATE INDEX "OfflineSyncItem_nextRetryAt_idx" ON "OfflineSyncItem"("nextRetryAt");
CREATE INDEX "OfflineSyncItem_sessionId_idx" ON "OfflineSyncItem"("sessionId");
CREATE UNIQUE INDEX "OfflineLeadDraft_userId_clientLeadId_key" ON "OfflineLeadDraft"("userId", "clientLeadId");
CREATE INDEX "OfflineLeadDraft_userId_status_idx" ON "OfflineLeadDraft"("userId", "status");
CREATE INDEX "OfflineLeadDraft_syncItemId_idx" ON "OfflineLeadDraft"("syncItemId");
CREATE INDEX "OfflineConflictRecord_userId_idx" ON "OfflineConflictRecord"("userId");
CREATE INDEX "OfflineConflictRecord_syncItemId_idx" ON "OfflineConflictRecord"("syncItemId");

ALTER TABLE "OfflineSyncSession"
  ADD CONSTRAINT "OfflineSyncSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfflineSyncItem"
  ADD CONSTRAINT "OfflineSyncItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflineSyncItem"
  ADD CONSTRAINT "OfflineSyncItem_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "OfflineSyncSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfflineLeadDraft"
  ADD CONSTRAINT "OfflineLeadDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflineLeadDraft"
  ADD CONSTRAINT "OfflineLeadDraft_syncItemId_fkey"
  FOREIGN KEY ("syncItemId") REFERENCES "OfflineSyncItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfflineLeadDraft"
  ADD CONSTRAINT "OfflineLeadDraft_serverLeadId_fkey"
  FOREIGN KEY ("serverLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfflineConflictRecord"
  ADD CONSTRAINT "OfflineConflictRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflineConflictRecord"
  ADD CONSTRAINT "OfflineConflictRecord_syncItemId_fkey"
  FOREIGN KEY ("syncItemId") REFERENCES "OfflineSyncItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
