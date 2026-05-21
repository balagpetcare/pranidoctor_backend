-- Phase 1 (P1-01): additive authentication audit trail

CREATE TYPE "AuthAuditAction" AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGOUT',
  'OTP_REQUEST',
  'OTP_VERIFY_SUCCESS',
  'OTP_VERIFY_FAILURE',
  'REFRESH_SUCCESS',
  'REFRESH_FAILURE',
  'PERMISSION_DENIED',
  'SESSION_REVOKED'
);

CREATE TABLE "AuthAuditEvent" (
  "id" TEXT NOT NULL,
  "action" "AuthAuditAction" NOT NULL,
  "userId" TEXT,
  "role" "UserRole",
  "channel" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthAuditEvent_userId_createdAt_idx" ON "AuthAuditEvent"("userId", "createdAt");
CREATE INDEX "AuthAuditEvent_action_createdAt_idx" ON "AuthAuditEvent"("action", "createdAt");

ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
