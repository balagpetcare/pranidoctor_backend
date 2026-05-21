-- P6 — AI Veterinary Core (assistant layer, additive)

CREATE TYPE "AiAssistantStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ESCALATED');
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "AiMemoryKind" AS ENUM ('CONVERSATION', 'CASE_CONTEXT', 'PREFERENCE');
CREATE TYPE "AiRiskBucket" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AiEscalationReason" AS ENUM (
  'HIGH_RISK',
  'EMERGENCY_SYMPTOM',
  'LOW_CONFIDENCE',
  'DOCTOR_REQUEST',
  'POLICY_REFUSAL'
);
CREATE TYPE "AiEscalationStatus" AS ENUM ('PENDING_REVIEW', 'QUEUED', 'HANDED_OFF', 'DISMISSED');

CREATE TABLE "AiAssistantSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "caseId" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'bn',
  "status" "AiAssistantStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAssistantSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAssistantMessage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" "AiMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "locale" TEXT,
  "inputJson" JSONB,
  "outputJson" JSONB,
  "refused" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAssistantMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAssistantMemory" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "userId" TEXT NOT NULL,
  "kind" "AiMemoryKind" NOT NULL,
  "key" TEXT NOT NULL,
  "valueJson" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAssistantMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiTriageRecord" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "userId" TEXT NOT NULL,
  "caseId" TEXT,
  "riskBucket" "AiRiskBucket" NOT NULL,
  "urgencyLevel" INTEGER NOT NULL,
  "recommendation" TEXT NOT NULL,
  "escalationRequired" BOOLEAN NOT NULL DEFAULT false,
  "symptomsJson" JSONB,
  "mediaMetadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiTriageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiEscalationRecord" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "userId" TEXT NOT NULL,
  "caseId" TEXT,
  "reason" "AiEscalationReason" NOT NULL,
  "status" "AiEscalationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "handoffNote" TEXT,
  "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiEscalationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSafetyAuditLog" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "detailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiSafetyAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiAssistantSession_userId_idx" ON "AiAssistantSession"("userId");
CREATE INDEX "AiAssistantSession_caseId_idx" ON "AiAssistantSession"("caseId");
CREATE INDEX "AiAssistantSession_status_idx" ON "AiAssistantSession"("status");
CREATE INDEX "AiAssistantMessage_sessionId_createdAt_idx" ON "AiAssistantMessage"("sessionId", "createdAt");
CREATE UNIQUE INDEX "AiAssistantMemory_userId_kind_key_key" ON "AiAssistantMemory"("userId", "kind", "key");
CREATE INDEX "AiAssistantMemory_userId_idx" ON "AiAssistantMemory"("userId");
CREATE INDEX "AiAssistantMemory_expiresAt_idx" ON "AiAssistantMemory"("expiresAt");
CREATE INDEX "AiTriageRecord_userId_idx" ON "AiTriageRecord"("userId");
CREATE INDEX "AiTriageRecord_caseId_idx" ON "AiTriageRecord"("caseId");
CREATE INDEX "AiTriageRecord_riskBucket_idx" ON "AiTriageRecord"("riskBucket");
CREATE INDEX "AiEscalationRecord_userId_idx" ON "AiEscalationRecord"("userId");
CREATE INDEX "AiEscalationRecord_caseId_idx" ON "AiEscalationRecord"("caseId");
CREATE INDEX "AiEscalationRecord_status_idx" ON "AiEscalationRecord"("status");
CREATE INDEX "AiSafetyAuditLog_sessionId_idx" ON "AiSafetyAuditLog"("sessionId");
CREATE INDEX "AiSafetyAuditLog_userId_idx" ON "AiSafetyAuditLog"("userId");
CREATE INDEX "AiSafetyAuditLog_action_idx" ON "AiSafetyAuditLog"("action");

ALTER TABLE "AiAssistantSession"
  ADD CONSTRAINT "AiAssistantSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAssistantSession"
  ADD CONSTRAINT "AiAssistantSession_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiAssistantMessage"
  ADD CONSTRAINT "AiAssistantMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AiAssistantSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiAssistantMemory"
  ADD CONSTRAINT "AiAssistantMemory_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AiAssistantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiTriageRecord"
  ADD CONSTRAINT "AiTriageRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AiAssistantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiEscalationRecord"
  ADD CONSTRAINT "AiEscalationRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AiAssistantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiSafetyAuditLog"
  ADD CONSTRAINT "AiSafetyAuditLog_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AiAssistantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
