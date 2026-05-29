-- AI governance kill switch — global persisted state + audit history

CREATE TABLE "AiGovernanceState" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "llmDisabled" BOOLEAN NOT NULL DEFAULT false,
    "version" BIGINT NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,
    "updatedByRole" TEXT,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'startup_sync',

    CONSTRAINT "AiGovernanceState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiGovernanceStateHistory" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL DEFAULT 'global',
    "llmDisabled" BOOLEAN NOT NULL,
    "previousLlmDisabled" BOOLEAN NOT NULL,
    "version" BIGINT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "reason" TEXT,
    "source" TEXT NOT NULL,
    "requestId" TEXT,
    "correlationId" TEXT,
    "rollbackOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGovernanceStateHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiGovernanceStateHistory_stateId_createdAt_idx" ON "AiGovernanceStateHistory"("stateId", "createdAt");
CREATE INDEX "AiGovernanceStateHistory_actorId_createdAt_idx" ON "AiGovernanceStateHistory"("actorId", "createdAt");

ALTER TABLE "AiGovernanceStateHistory" ADD CONSTRAINT "AiGovernanceStateHistory_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "AiGovernanceState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AiGovernanceState" ("id", "llmDisabled", "version", "updatedAt", "source")
VALUES ('global', false, 1, CURRENT_TIMESTAMP, 'migration_seed')
ON CONFLICT ("id") DO NOTHING;
