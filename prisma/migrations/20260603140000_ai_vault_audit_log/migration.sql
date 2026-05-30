-- AI Secret Vault — API key audit log

CREATE TYPE "AiApiKeyAuditAction" AS ENUM (
  'CREATED',
  'UPDATED',
  'DISABLED',
  'ENABLED',
  'ROTATED',
  'TESTED',
  'REVOKED',
  'IMPORTED'
);

CREATE TABLE "ai_api_key_audit_logs" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "providerKey" VARCHAR(32) NOT NULL,
    "action" "AiApiKeyAuditAction" NOT NULL,
    "actorUserId" TEXT,
    "actorRole" VARCHAR(32),
    "reason" TEXT,
    "metadataJson" JSONB,
    "ipAddress" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_api_key_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_api_key_audit_logs_apiKeyId_createdAt_idx"
  ON "ai_api_key_audit_logs"("apiKeyId", "createdAt");

CREATE INDEX "ai_api_key_audit_logs_providerKey_createdAt_idx"
  ON "ai_api_key_audit_logs"("providerKey", "createdAt");

CREATE INDEX "ai_api_key_audit_logs_action_createdAt_idx"
  ON "ai_api_key_audit_logs"("action", "createdAt");

ALTER TABLE "ai_api_key_audit_logs"
  ADD CONSTRAINT "ai_api_key_audit_logs_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "ai_api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
