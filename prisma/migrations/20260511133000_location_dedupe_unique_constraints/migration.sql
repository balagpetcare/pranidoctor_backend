-- Location master: partial unique indexes on TRIM(code) (non-empty codes only).
--
-- PREREQUISITES (dev/staging/prod):
--   1) Read data/locations/reports/BACKUP_INSTRUCTIONS.md and take a DB backup.
--   2) npm run locations:duplicates   (or locations:report-duplicates)
--   3) npm run locations:dedupe -- --dry-run
--   4) Resolve every group in partialUniqueTrimCodeConflicts where safeForAutoMerge is false
--      (same trimmed code, different labels) BEFORE deploy, or npm run locations:dedupe -- --apply
--      after reviewing the dry-run (safe groups merge first; unsafe groups need manual CSV/DB fix).
--
-- If this migration failed with P3009, mark the failed attempt rolled back, clean duplicates, then:
--   npx prisma migrate deploy

-- Pre-flight: fail fast with a clear message instead of a generic unique-index error.
DO $$
DECLARE
  bad_divisions int;
  bad_districts int;
  bad_upazilas int;
  bad_unions int;
  bad_villages int;
BEGIN
  SELECT count(*)::int INTO bad_divisions FROM (
    SELECT trim(both from "code") AS c
    FROM "Division"
    WHERE "code" IS NOT NULL AND trim(both from "code") <> ''
    GROUP BY 1
    HAVING count(*) > 1
  ) t;

  SELECT count(*)::int INTO bad_districts FROM (
    SELECT "divisionId", trim(both from "code") AS c
    FROM "District"
    WHERE "code" IS NOT NULL AND trim(both from "code") <> ''
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) t;

  SELECT count(*)::int INTO bad_upazilas FROM (
    SELECT "districtId", trim(both from "code") AS c
    FROM "Upazila"
    WHERE "code" IS NOT NULL AND trim(both from "code") <> ''
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) t;

  SELECT count(*)::int INTO bad_unions FROM (
    SELECT "upazilaId", trim(both from "code") AS c
    FROM "Union"
    WHERE "code" IS NOT NULL AND trim(both from "code") <> ''
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) t;

  SELECT count(*)::int INTO bad_villages FROM (
    SELECT "unionId", trim(both from "code") AS c
    FROM "Village"
    WHERE "code" IS NOT NULL AND trim(both from "code") <> ''
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) t;

  IF bad_divisions + bad_districts + bad_upazilas + bad_unions + bad_villages > 0 THEN
    RAISE EXCEPTION
      'location_dedupe_unique_constraints: duplicate trimmed codes still present '
      '(divisions=%, districts=%, upazilas=%, unions=%, villages=%). '
      'Run npm run locations:duplicates, fix data, npm run locations:dedupe -- --apply, then redeploy.',
      bad_divisions, bad_districts, bad_upazilas, bad_unions, bad_villages;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Division_code_trim_uidx"
ON "Division" ((TRIM(BOTH FROM "code")))
WHERE "code" IS NOT NULL AND TRIM(BOTH FROM "code") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "District_division_code_trim_uidx"
ON "District" ("divisionId", (TRIM(BOTH FROM "code")))
WHERE "code" IS NOT NULL AND TRIM(BOTH FROM "code") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Upazila_district_code_trim_uidx"
ON "Upazila" ("districtId", (TRIM(BOTH FROM "code")))
WHERE "code" IS NOT NULL AND TRIM(BOTH FROM "code") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Union_upazila_code_trim_uidx"
ON "Union" ("upazilaId", (TRIM(BOTH FROM "code")))
WHERE "code" IS NOT NULL AND TRIM(BOTH FROM "code") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Village_union_code_trim_uidx"
ON "Village" ("unionId", (TRIM(BOTH FROM "code")))
WHERE "code" IS NOT NULL AND TRIM(BOTH FROM "code") <> '';
