import * as fs from "node:fs";
import * as path from "node:path";

import type { PrismaClient } from "../../../src/generated/prisma/index.js";
import { bodyRows, parseCsv } from "./csv-parse.js";
import { readTextFile, resolveLocationDataDir } from "./data-dir.js";
import { normalizeLocationCode } from "./normalize.js";

export type VerifyLocationReport = {
  generatedAt: string;
  passed: boolean;
  dbCounts: {
    divisions: number;
    districts: number;
    upazilas: number;
    unions: number;
    villages: number;
  };
  sheetCounts: {
    divisions: number;
    districts: number;
    upazilas: number;
    unions: number;
    villages: number;
  };
  orphanChecks: {
    districtsWithoutDivision: number;
    upazilasWithoutDistrict: number;
    unionsWithoutUpazila: number;
    villagesWithoutUnion: number;
  };
  duplicateNameGroups: {
    districts: number;
    upazilas: number;
    unions: number;
  };
  errors: string[];
};

function countCsvRows(dataDir: string, file: string): number {
  const raw = readTextFile(dataDir, file);
  if (!raw) return 0;
  return bodyRows(parseCsv(raw)).length;
}

export async function verifyLocationHierarchy(
  prisma: PrismaClient,
  dataDir?: string,
): Promise<VerifyLocationReport> {
  const dir = dataDir ?? resolveLocationDataDir();
  const errors: string[] = [];

  const [divisions, districts, upazilas, unions, villages] = await Promise.all([
    prisma.division.count(),
    prisma.district.count(),
    prisma.upazila.count(),
    prisma.union.count(),
    prisma.village.count(),
  ]);

  const dbCounts = {
    divisions,
    districts,
    upazilas,
    unions,
    villages,
  };

  const sheetCounts = {
    divisions: countCsvRows(dir, "divisions.csv"),
    districts: countCsvRows(dir, "districts.csv"),
    upazilas: countCsvRows(dir, "upazilas.csv"),
    unions: countCsvRows(dir, "unions.csv"),
    villages: countCsvRows(dir, "villages.csv"),
  };

  if (dbCounts.divisions < sheetCounts.divisions) {
    errors.push(
      `Division count ${dbCounts.divisions} < sheet ${sheetCounts.divisions}`,
    );
  }
  if (dbCounts.districts < sheetCounts.districts * 0.95) {
    errors.push(
      `District count ${dbCounts.districts} materially below sheet ${sheetCounts.districts}`,
    );
  }
  if (dbCounts.upazilas < sheetCounts.upazilas * 0.95) {
    errors.push(
      `Upazila count ${dbCounts.upazilas} materially below sheet ${sheetCounts.upazilas}`,
    );
  }
  if (dbCounts.unions < sheetCounts.unions * 0.95) {
    errors.push(
      `Union count ${dbCounts.unions} materially below sheet ${sheetCounts.unions}`,
    );
  }

  const districtsOrphan = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM "District" d
    WHERE NOT EXISTS (SELECT 1 FROM "Division" div WHERE div.id = d."divisionId")
  `;
  const upazilasOrphan = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM "Upazila" u
    WHERE NOT EXISTS (SELECT 1 FROM "District" d WHERE d.id = u."districtId")
  `;
  const unionsOrphan = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM "Union" un
    WHERE NOT EXISTS (SELECT 1 FROM "Upazila" u WHERE u.id = un."upazilaId")
  `;
  const villagesOrphan = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM "Village" v
    WHERE NOT EXISTS (SELECT 1 FROM "Union" u WHERE u.id = v."unionId")
  `;

  const orphanChecks = {
    districtsWithoutDivision: Number(districtsOrphan[0]?.c ?? 0),
    upazilasWithoutDistrict: Number(upazilasOrphan[0]?.c ?? 0),
    unionsWithoutUpazila: Number(unionsOrphan[0]?.c ?? 0),
    villagesWithoutUnion: Number(villagesOrphan[0]?.c ?? 0),
  };

  for (const [label, n] of Object.entries(orphanChecks)) {
    if (n > 0) errors.push(`Orphan rows: ${label}=${n}`);
  }

  const dupDistricts = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "divisionId", LOWER(TRIM("name")) AS n, COUNT(*) AS cnt
      FROM "District"
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) t
  `;
  const dupUpazilas = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "districtId", LOWER(TRIM("name")) AS n, COUNT(*) AS cnt
      FROM "Upazila"
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) t
  `;
  const dupUnions = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "upazilaId", LOWER(TRIM("name")) AS n, COUNT(*) AS cnt
      FROM "Union"
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) t
  `;

  const duplicateNameGroups = {
    districts: Number(dupDistricts[0]?.c ?? 0),
    upazilas: Number(dupUpazilas[0]?.c ?? 0),
    unions: Number(dupUnions[0]?.c ?? 0),
  };

  if (duplicateNameGroups.districts > 0) {
    errors.push(`Duplicate district names under same division: ${duplicateNameGroups.districts} groups`);
  }
  if (duplicateNameGroups.upazilas > 0) {
    errors.push(`Duplicate upazila names under same district: ${duplicateNameGroups.upazilas} groups`);
  }
  if (duplicateNameGroups.unions > 0) {
    errors.push(`Duplicate union names under same upazila: ${duplicateNameGroups.unions} groups`);
  }

  const report: VerifyLocationReport = {
    generatedAt: new Date().toISOString(),
    passed: errors.length === 0,
    dbCounts,
    sheetCounts,
    orphanChecks,
    duplicateNameGroups,
    errors,
  };

  const outPath = path.resolve(process.cwd(), "docs/LOCATION_VERIFY_REPORT.md");

  const md = [
    "# Location verify report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `**Status:** ${report.passed ? "PASSED" : "FAILED"}`,
    "",
    "## DB vs sheet counts",
    "",
    "| Level | DB | Sheet |",
    "|-------|-----|-------|",
    `| Division | ${dbCounts.divisions} | ${sheetCounts.divisions} |`,
    `| District | ${dbCounts.districts} | ${sheetCounts.districts} |`,
    `| Upazila | ${dbCounts.upazilas} | ${sheetCounts.upazilas} |`,
    `| Union | ${dbCounts.unions} | ${sheetCounts.unions} |`,
    `| Village | ${dbCounts.villages} | ${sheetCounts.villages} |`,
    "",
    "## Errors",
    "",
    ...(errors.length ? errors.map((e) => `- ${e}`) : ["- None"]),
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md, "utf8");

  return report;
}
