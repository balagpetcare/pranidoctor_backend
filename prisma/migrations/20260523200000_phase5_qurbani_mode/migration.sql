-- Phase 5: Qurbani mode (goal type, countdown, readiness)

CREATE TYPE "FatteningBatchGoalType" AS ENUM ('NORMAL', 'QURBANI');

ALTER TABLE "FatteningBatch" ADD COLUMN "goalType" "FatteningBatchGoalType" NOT NULL DEFAULT 'NORMAL';

UPDATE "FatteningBatch"
SET "goalType" = 'QURBANI'
WHERE "goal" IS NOT NULL
  AND (
    LOWER("goal") LIKE '%qurbani%'
    OR "goal" LIKE '%কুরবানি%'
    OR "goal" LIKE '%কোরবানি%'
  );
