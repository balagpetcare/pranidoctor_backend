-- Per-feature / per-provider AI governance scopes + extended audit fields

CREATE TABLE "AiGovernanceScope" (
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "version" BIGINT NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,
    "updatedByRole" TEXT,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'startup_sync',

    CONSTRAINT "AiGovernanceScope_pkey" PRIMARY KEY ("scopeType","scopeId")
);

ALTER TABLE "AiGovernanceStateHistory" ADD COLUMN "changeKind" TEXT NOT NULL DEFAULT 'global';
ALTER TABLE "AiGovernanceStateHistory" ADD COLUMN "scopeType" TEXT;
ALTER TABLE "AiGovernanceStateHistory" ADD COLUMN "scopeId" TEXT;
ALTER TABLE "AiGovernanceStateHistory" ADD COLUMN "disabled" BOOLEAN;
ALTER TABLE "AiGovernanceStateHistory" ADD COLUMN "previousDisabled" BOOLEAN;

CREATE INDEX "AiGovernanceStateHistory_changeKind_createdAt_idx" ON "AiGovernanceStateHistory"("changeKind", "createdAt");

INSERT INTO "AiGovernanceScope" ("scopeType", "scopeId", "disabled", "version", "updatedAt", "source")
VALUES
  ('feature', 'CHAT', false, 1, CURRENT_TIMESTAMP, 'migration_seed'),
  ('feature', 'FARM_BRIEFING', false, 1, CURRENT_TIMESTAMP, 'migration_seed'),
  ('feature', 'FARM_QUERY', false, 1, CURRENT_TIMESTAMP, 'migration_seed'),
  ('provider', 'openai', false, 1, CURRENT_TIMESTAMP, 'migration_seed'),
  ('provider', 'anthropic', false, 1, CURRENT_TIMESTAMP, 'migration_seed')
ON CONFLICT ("scopeType", "scopeId") DO NOTHING;
