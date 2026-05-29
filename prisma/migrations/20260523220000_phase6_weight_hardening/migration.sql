-- Phase 6: weight record hardening (method, photo, one per day)

CREATE TYPE "WeightRecordMethod" AS ENUM ('SCALE', 'TAPE', 'ESTIMATE', 'OTHER');

ALTER TABLE "WeightRecord" ADD COLUMN "recordedOn" DATE;
ALTER TABLE "WeightRecord" ADD COLUMN "method" "WeightRecordMethod";
ALTER TABLE "WeightRecord" ADD COLUMN "photoUrl" TEXT;

UPDATE "WeightRecord"
SET "recordedOn" = ("recordedAt" AT TIME ZONE 'UTC')::date,
    "method" = 'SCALE'
WHERE "recordedOn" IS NULL;

-- Remove duplicate (batch, animal, day) rows — keep latest recordedAt
DELETE FROM "WeightRecord" w
USING (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "batchId", "animalId", "recordedOn"
      ORDER BY "recordedAt" DESC, "createdAt" DESC
    ) AS rn
  FROM "WeightRecord"
) d
WHERE w.id = d.id AND d.rn > 1;

ALTER TABLE "WeightRecord" ALTER COLUMN "recordedOn" SET NOT NULL;
ALTER TABLE "WeightRecord" ALTER COLUMN "method" SET NOT NULL;
ALTER TABLE "WeightRecord" ALTER COLUMN "method" SET DEFAULT 'SCALE';

CREATE UNIQUE INDEX "WeightRecord_batchId_animalId_recordedOn_key"
  ON "WeightRecord"("batchId", "animalId", "recordedOn");

CREATE INDEX "WeightRecord_customerId_batchId_recordedOn_idx"
  ON "WeightRecord"("customerId", "batchId", "recordedOn");
