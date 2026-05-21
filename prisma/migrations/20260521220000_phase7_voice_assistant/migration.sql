-- P7 — Bangla voice assistant (transcript metadata, no raw audio default)

CREATE TYPE "VoiceSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED', 'INTERRUPTED');
CREATE TYPE "VoiceSttMode" AS ENUM ('STREAMING', 'UPLOAD');
CREATE TYPE "VoiceBandwidthMode" AS ENUM ('FULL', 'LOW', 'TRANSCRIPT_ONLY');

CREATE TABLE "VoiceSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "aiSessionId" TEXT,
  "caseId" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'bn',
  "bandwidthMode" "VoiceBandwidthMode" NOT NULL DEFAULT 'FULL',
  "status" "VoiceSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "interruptedAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceTranscript" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "normalizedText" TEXT NOT NULL,
  "rawHint" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "sttMode" "VoiceSttMode" NOT NULL,
  "partial" BOOLEAN NOT NULL DEFAULT false,
  "locale" TEXT NOT NULL DEFAULT 'bn',
  "durationMs" INTEGER,
  "audioSizeBytes" INTEGER,
  "codec" TEXT,
  "retainAudio" BOOLEAN NOT NULL DEFAULT false,
  "retrySuggested" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceTranscript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceNavigationEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "utterance" TEXT NOT NULL,
  "aliasMatched" TEXT,
  "action" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceNavigationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoiceSession_userId_idx" ON "VoiceSession"("userId");
CREATE INDEX "VoiceSession_caseId_idx" ON "VoiceSession"("caseId");
CREATE INDEX "VoiceSession_status_idx" ON "VoiceSession"("status");
CREATE INDEX "VoiceTranscript_sessionId_createdAt_idx" ON "VoiceTranscript"("sessionId", "createdAt");
CREATE INDEX "VoiceNavigationEvent_sessionId_idx" ON "VoiceNavigationEvent"("sessionId");
CREATE INDEX "VoiceNavigationEvent_action_idx" ON "VoiceNavigationEvent"("action");

ALTER TABLE "VoiceSession"
  ADD CONSTRAINT "VoiceSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceSession"
  ADD CONSTRAINT "VoiceSession_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VoiceTranscript"
  ADD CONSTRAINT "VoiceTranscript_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "VoiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoiceNavigationEvent"
  ADD CONSTRAINT "VoiceNavigationEvent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "VoiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
