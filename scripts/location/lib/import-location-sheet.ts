import * as fs from "node:fs";
import * as path from "node:path";

import { Prisma } from "../../../src/generated/prisma/index.js";
import type { PrismaClient } from "../../../src/generated/prisma/index.js";
import { bodyRows, parseCsv } from "./csv-parse.js";
import { readTextFile, resolveLocationDataDir } from "./data-dir.js";
import {
  normalizeLocationCode,
  normalizeLocationName,
  nonempty,
  parseBool,
  parseNullableNumber,
  validateLatitude,
  validateLongitude,
} from "./normalize.js";
import { slugifyGeoLabel } from "./slugify.js";
import {
  isHierarchyUnionHeader,
  parentNameKey,
  validateUnionCsvHierarchyRow,
} from "./validation.js";

const BATCH_SIZE = 500;
const LEGACY_DIVISION_SLUG: Record<string, string> = { "30": "dhaka-division-geo" };

export type LevelStats = {
  inserted: number;
  updated: number;
  skipped: number;
  invalid: number;
};

export type ImportLocationReport = {
  generatedAt: string;
  dataDir: string;
  divisions: LevelStats;
  districts: LevelStats;
  upazilas: LevelStats;
  unions: LevelStats;
  villages: LevelStats;
  summary: {
    missingParent: number;
    invalidCoordinate: number;
    duplicateNamesSkipped: number;
  };
  notes: string[];
};

function emptyLevel(): LevelStats {
  return { inserted: 0, updated: 0, skipped: 0, invalid: 0 };
}

function toDecimal(n: number | null): Prisma.Decimal | null {
  if (n == null) return null;
  try {
    return new Prisma.Decimal(n);
  } catch {
    return null;
  }
}

async function uniqueSlug(
  prisma: PrismaClient,
  model: "division" | "district" | "upazila" | "union" | "village",
  base: string,
): Promise<string> {
  let slug = base;
  let n = 0;
  for (;;) {
    const exists =
      model === "division"
        ? await prisma.division.findFirst({ where: { slug }, select: { id: true } })
        : model === "district"
          ? await prisma.district.findFirst({ where: { slug }, select: { id: true } })
          : model === "upazila"
            ? await prisma.upazila.findFirst({ where: { slug }, select: { id: true } })
            : model === "union"
              ? await prisma.union.findFirst({ where: { slug }, select: { id: true } })
              : await prisma.village.findFirst({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

type JsonLevelFile = {
  level: "divisions" | "districts" | "upazilas" | "unions" | "villages";
  rows: Record<string, string>[];
};

async function loadJsonRows(
  dataDir: string,
  level: JsonLevelFile["level"],
): Promise<Record<string, string>[] | null> {
  const p = path.join(dataDir, `${level}.json`);
  if (!fs.existsSync(p)) return null;
  const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as JsonLevelFile | Record<string, string>[];
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
  return null;
}

async function loadXlsxSheet(
  dataDir: string,
  sheetName: string,
): Promise<string[][] | null> {
  const p = path.join(dataDir, `${sheetName}.xlsx`);
  if (!fs.existsSync(p)) return null;
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.readFile(p);
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }) as string[][];
    return rows.map((r) => r.map((c) => String(c ?? "")));
  } catch {
    throw new Error(
      `Cannot read ${p}. Install optional dependency: npm install xlsx`,
    );
  }
}

function readCsvFromDir(dataDir: string, name: string): string[][] | null {
  const raw = readTextFile(dataDir, name);
  if (!raw) return null;
  return parseCsv(raw);
}

async function resolveUpazilaId(
  prisma: PrismaClient,
  divisionByCode: Map<string, { id: string }>,
  divCode: string,
  distCode: string,
  upCode: string,
): Promise<string | null> {
  const divN = normalizeLocationCode(divCode);
  const distN = normalizeLocationCode(distCode);
  const upN = normalizeLocationCode(upCode);
  const div = divisionByCode.get(divN) ?? divisionByCode.get(divCode);
  if (!div) return null;
  const dists = await prisma.district.findMany({
    where: { divisionId: div.id, isActive: true },
    select: { id: true, code: true },
  });
  const dist = dists.find((d) => normalizeLocationCode(d.code) === distN);
  if (!dist) return null;
  const ups = await prisma.upazila.findMany({
    where: { districtId: dist.id, isActive: true },
    select: { id: true, code: true },
  });
  const up = ups.find((u) => normalizeLocationCode(u.code) === upN);
  return up?.id ?? null;
}

export type ImportLocationOptions = {
  dataDir?: string;
  dryRun?: boolean;
};

export async function importLocationSheet(
  prisma: PrismaClient,
  options: ImportLocationOptions = {},
): Promise<ImportLocationReport> {
  const dataDir = options.dataDir ?? resolveLocationDataDir();
  const dryRun = options.dryRun ?? false;

  const report: ImportLocationReport = {
    generatedAt: new Date().toISOString(),
    dataDir,
    divisions: emptyLevel(),
    districts: emptyLevel(),
    upazilas: emptyLevel(),
    unions: emptyLevel(),
    villages: emptyLevel(),
    summary: {
      missingParent: 0,
      invalidCoordinate: 0,
      duplicateNamesSkipped: 0,
    },
    notes: dryRun ? ["dry_run=true (no database writes)"] : [],
  };

  const divisionByCode = new Map<string, { id: string }>();
  const districtByCode = new Map<string, { id: string; divisionCode: string }>();
  const seenDivisionNames = new Set<string>();
  const seenDistrictNames = new Set<string>();
  const seenUpazilaNames = new Set<string>();
  const seenUnionNames = new Set<string>();

  let divisionCache = await prisma.division.findMany({
    select: { id: true, slug: true, code: true, nameEn: true },
  });
  let districtCache = await prisma.district.findMany({
    select: { id: true, slug: true, divisionId: true, code: true, nameEn: true },
  });
  let upazilaCache = await prisma.upazila.findMany({
    select: { id: true, slug: true, districtId: true, code: true, nameEn: true },
  });

  // --- Divisions ---
  const divCsv =
    readCsvFromDir(dataDir, "divisions.csv") ??
    (await loadXlsxSheet(dataDir, "divisions"));
  if (!divCsv) {
    throw new Error(`divisions.csv missing under ${dataDir}`);
  }

  for (const row of bodyRows(divCsv)) {
    const code = nonempty(row[0]) ? normalizeLocationCode(row[0]) : null;
    const nameEn = nonempty(row[1]);
    const nameBn = nonempty(row[2]);
    const latN = parseNullableNumber(row[3]);
    const lngN = parseNullableNumber(row[4]);
    if (latN.invalid || lngN.invalid) report.summary.invalidCoordinate += 1;
    let latNum = latN.n;
    let lngNum = lngN.n;
    if (latNum != null && !validateLatitude(latNum)) {
      report.summary.invalidCoordinate += 1;
      latNum = null;
    }
    if (lngNum != null && !validateLongitude(lngNum)) {
      report.summary.invalidCoordinate += 1;
      lngNum = null;
    }
    if (!code || !nameEn) {
      report.divisions.invalid += 1;
      continue;
    }

    const nameKey = normalizeLocationName(nameEn).toLowerCase();
    if (seenDivisionNames.has(nameKey)) {
      report.summary.duplicateNamesSkipped += 1;
      report.divisions.skipped += 1;
      continue;
    }
    seenDivisionNames.add(nameKey);

    const legacySlug = LEGACY_DIVISION_SLUG[code];
    const existing =
      divisionCache.find((d) => normalizeLocationCode(d.code) === code) ??
      (legacySlug ? divisionCache.find((d) => d.slug === legacySlug) : undefined) ??
      divisionCache.find(
        (d) =>
          d.nameEn &&
          normalizeLocationName(d.nameEn).toLowerCase() === nameKey,
      ) ??
      null;

    const slug =
      existing?.slug ??
      legacySlug ??
      (await uniqueSlug(
        prisma,
        "division",
        `${slugifyGeoLabel(nameEn) || "division"}-division`,
      ));

    if (!dryRun) {
      if (existing) {
        await prisma.division.update({
          where: { id: existing.id },
          data: {
            name: nameEn,
            nameEn,
            nameBn,
            code,
            latitude: toDecimal(latNum),
            longitude: toDecimal(lngNum),
            source: nonempty(row[5]),
            isVerified: parseBool(row[6]),
            isActive: true,
          },
        });
        report.divisions.updated += 1;
      } else {
        await prisma.division.create({
          data: {
            slug,
            name: nameEn,
            nameEn,
            nameBn,
            code,
            latitude: toDecimal(latNum),
            longitude: toDecimal(lngNum),
            source: nonempty(row[5]),
            isVerified: parseBool(row[6]),
            isActive: true,
            sortOrder: 0,
          },
        });
        report.divisions.inserted += 1;
      }
      divisionCache = await prisma.division.findMany({
        select: { id: true, slug: true, code: true, nameEn: true },
      });
    } else if (existing) {
      report.divisions.updated += 1;
    } else {
      report.divisions.inserted += 1;
    }

    const persisted = divisionCache.find((d) => normalizeLocationCode(d.code) === code);
    if (persisted) divisionByCode.set(code, { id: persisted.id });
  }

  console.log(`Division: ${report.divisions.inserted} inserted, ${report.divisions.updated} updated`);

  // --- Districts ---
  const distCsv = readCsvFromDir(dataDir, "districts.csv");
  if (distCsv) {
    for (const row of bodyRows(distCsv)) {
      const divCode = nonempty(row[0]) ? normalizeLocationCode(row[0]) : null;
      const distCode = nonempty(row[1]) ? normalizeLocationCode(row[1]) : null;
      const nameEn = nonempty(row[2]);
      const nameBn = nonempty(row[3]);
      if (!divCode || !distCode || !nameEn) {
        report.districts.invalid += 1;
        continue;
      }
      const div = divisionByCode.get(divCode);
      if (!div) {
        report.summary.missingParent += 1;
        report.districts.invalid += 1;
        continue;
      }

      const nk = parentNameKey(div.id, nameEn, nameBn);
      if (seenDistrictNames.has(nk)) {
        report.summary.duplicateNamesSkipped += 1;
        report.districts.skipped += 1;
        continue;
      }
      seenDistrictNames.add(nk);

      const existing =
        districtCache.find(
          (r) =>
            r.divisionId === div.id && normalizeLocationCode(r.code) === distCode,
        ) ??
        districtCache.find(
          (r) =>
            r.divisionId === div.id &&
            r.nameEn &&
            normalizeLocationName(r.nameEn).toLowerCase() ===
              normalizeLocationName(nameEn).toLowerCase(),
        ) ??
        null;

      const slug =
        existing?.slug ??
        (await uniqueSlug(
          prisma,
          "district",
          `${slugifyGeoLabel(nameEn) || "district"}-district`,
        ));

      if (!dryRun) {
        const latN = parseNullableNumber(row[4]);
        const lngN = parseNullableNumber(row[5]);
        const data = {
          name: nameEn,
          nameEn,
          nameBn,
          code: distCode,
          latitude: toDecimal(latN.n),
          longitude: toDecimal(lngN.n),
          source: nonempty(row[6]),
          isVerified: parseBool(row[7]),
          isActive: true,
        };
        if (existing) {
          await prisma.district.update({ where: { id: existing.id }, data });
          report.districts.updated += 1;
        } else {
          await prisma.district.create({
            data: { divisionId: div.id, slug, sortOrder: 0, ...data },
          });
          report.districts.inserted += 1;
        }
        districtCache = await prisma.district.findMany({
          select: { id: true, slug: true, divisionId: true, code: true, nameEn: true },
        });
      } else if (existing) {
        report.districts.updated += 1;
      } else {
        report.districts.inserted += 1;
      }

      const persisted = districtCache.find(
        (r) => r.divisionId === div.id && normalizeLocationCode(r.code) === distCode,
      );
      if (persisted) {
        districtByCode.set(distCode, { id: persisted.id, divisionCode: divCode });
      }
    }
  } else {
    report.notes.push("districts.csv missing — skipped districts.");
  }

  console.log(`District: ${report.districts.inserted} inserted, ${report.districts.updated} updated`);

  // --- Upazilas ---
  const upCsv = readCsvFromDir(dataDir, "upazilas.csv");
  if (upCsv) {
    for (const row of bodyRows(upCsv)) {
      const distCode = nonempty(row[0]) ? normalizeLocationCode(row[0]) : null;
      const upCode = nonempty(row[1]) ? normalizeLocationCode(row[1]) : null;
      const nameEn = nonempty(row[2]);
      const nameBn = nonempty(row[3]);
      if (!distCode || !upCode || !nameEn) {
        report.upazilas.invalid += 1;
        continue;
      }
      const dist = districtByCode.get(distCode);
      if (!dist) {
        report.summary.missingParent += 1;
        report.upazilas.invalid += 1;
        continue;
      }

      const nk = parentNameKey(dist.id, nameEn, nameBn);
      if (seenUpazilaNames.has(nk)) {
        report.summary.duplicateNamesSkipped += 1;
        report.upazilas.skipped += 1;
        continue;
      }
      seenUpazilaNames.add(nk);

      const existing =
        upazilaCache.find(
          (r) =>
            r.districtId === dist.id && normalizeLocationCode(r.code) === upCode,
        ) ?? null;

      const slug =
        existing?.slug ??
        (await uniqueSlug(
          prisma,
          "upazila",
          `${slugifyGeoLabel(nameEn) || "upazila"}-upazila`,
        ));

      if (!dryRun) {
        const latN = parseNullableNumber(row[4]);
        const lngN = parseNullableNumber(row[5]);
        const data = {
          name: nameEn,
          nameEn,
          nameBn,
          code: upCode,
          latitude: toDecimal(latN.n),
          longitude: toDecimal(lngN.n),
          source: nonempty(row[6]),
          isVerified: parseBool(row[7]),
          isActive: true,
        };
        if (existing) {
          await prisma.upazila.update({ where: { id: existing.id }, data });
          report.upazilas.updated += 1;
        } else {
          await prisma.upazila.create({
            data: { districtId: dist.id, slug, sortOrder: 0, ...data },
          });
          report.upazilas.inserted += 1;
        }
        upazilaCache = await prisma.upazila.findMany({
          select: { id: true, slug: true, districtId: true, code: true, nameEn: true },
        });
      } else if (existing) {
        report.upazilas.updated += 1;
      } else {
        report.upazilas.inserted += 1;
      }
    }
  } else {
    report.notes.push("upazilas.csv missing — skipped upazilas.");
  }

  console.log(`Upazila: ${report.upazilas.inserted} inserted, ${report.upazilas.updated} updated`);

  // --- Unions (batched) ---
  const unCsv = readCsvFromDir(dataDir, "unions.csv");
  if (unCsv && bodyRows(unCsv).length > 0) {
    const header = unCsv[0]?.join(",") ?? "";
    const hierarchy = isHierarchyUnionHeader(header);
    const unionRows = bodyRows(unCsv);
    let batchProcessed = 0;

    for (let offset = 0; offset < unionRows.length; offset += BATCH_SIZE) {
      const chunk = unionRows.slice(offset, offset + BATCH_SIZE);
      for (const row of chunk) {
        let upazilaId: string | null = null;
        let v: ReturnType<typeof validateUnionCsvHierarchyRow> | null = null;

        if (hierarchy) {
          v = validateUnionCsvHierarchyRow(row);
          if (!v.ok) {
            report.unions.invalid += 1;
            continue;
          }
          upazilaId = await resolveUpazilaId(
            prisma,
            divisionByCode,
            v.divisionCode!,
            v.districtCode!,
            v.upazilaCode!,
          );
          if (!upazilaId) {
            report.summary.missingParent += 1;
            report.unions.invalid += 1;
            continue;
          }
        } else {
          report.unions.invalid += 1;
          continue;
        }

        const unionCodeNorm = normalizeLocationCode(v!.unionCode!);
        const nameEn = v!.nameEn;
        const nameBn = v!.nameBn;
        const displayEn = nameEn ?? nameBn ?? "Union";

        const nk = parentNameKey(upazilaId!, nameEn, nameBn);
        if (seenUnionNames.has(nk)) {
          report.summary.duplicateNamesSkipped += 1;
          report.unions.skipped += 1;
          continue;
        }
        seenUnionNames.add(nk);

        const unionCandidates = await prisma.union.findMany({
          where: { upazilaId: upazilaId!, isActive: true },
          select: { id: true, slug: true, code: true, nameEn: true, nameBn: true },
        });

        const existing =
          unionCandidates.find((u) => normalizeLocationCode(u.code) === unionCodeNorm) ??
          unionCandidates.find((u) => {
            if (
              nameEn &&
              u.nameEn &&
              normalizeLocationName(u.nameEn).toLowerCase() ===
                normalizeLocationName(nameEn).toLowerCase()
            ) {
              return true;
            }
            if (
              nameBn &&
              u.nameBn &&
              normalizeLocationName(u.nameBn).toLowerCase() ===
                normalizeLocationName(nameBn).toLowerCase()
            ) {
              return true;
            }
            return false;
          }) ??
          null;

        const slug =
          existing?.slug ??
          (await uniqueSlug(
            prisma,
            "union",
            `${slugifyGeoLabel(displayEn) || "union"}-union`,
          ));

        if (!dryRun) {
          const data = {
            name: displayEn,
            nameEn,
            nameBn,
            code: unionCodeNorm,
            latitude: toDecimal(v!.lat),
            longitude: toDecimal(v!.lng),
            source: v!.source,
            isVerified: v!.source ? v!.isVerified : false,
            isActive: true,
          };
          if (existing) {
            await prisma.union.update({ where: { id: existing.id }, data });
            report.unions.updated += 1;
          } else {
            await prisma.union.create({
              data: { upazilaId: upazilaId!, slug, sortOrder: 0, ...data },
            });
            report.unions.inserted += 1;
          }
        } else if (existing) {
          report.unions.updated += 1;
        } else {
          report.unions.inserted += 1;
        }
      }

      batchProcessed += chunk.length;
      console.log(
        `Union: ${report.unions.inserted} inserted, ${report.unions.updated} updated (${batchProcessed}/${unionRows.length} rows)`,
      );
    }
  } else {
    report.notes.push("unions.csv missing or empty — union import skipped.");
  }

  // --- Villages (optional; sheet may be header-only) ---
  const vilCsv = readCsvFromDir(dataDir, "villages.csv");
  if (vilCsv && bodyRows(vilCsv).length > 0) {
    report.notes.push("villages.csv has rows — import not fully implemented until official village sheet is populated.");
  } else {
    report.notes.push("villages.csv empty or missing — village import skipped.");
  }

  const reportPath = path.join(dataDir, "import-report-backend.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  const docsReport = path.resolve(process.cwd(), "docs/LOCATION_IMPORT_REPORT.md");
  const md = [
    "# Location import report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Data directory: \`${report.dataDir}\``,
    "",
    "| Level | Inserted | Updated | Skipped | Invalid |",
    "|-------|----------|---------|---------|---------|",
    `| Division | ${report.divisions.inserted} | ${report.divisions.updated} | ${report.divisions.skipped} | ${report.divisions.invalid} |`,
    `| District | ${report.districts.inserted} | ${report.districts.updated} | ${report.districts.skipped} | ${report.districts.invalid} |`,
    `| Upazila | ${report.upazilas.inserted} | ${report.upazilas.updated} | ${report.upazilas.skipped} | ${report.upazilas.invalid} |`,
    `| Union | ${report.unions.inserted} | ${report.unions.updated} | ${report.unions.skipped} | ${report.unions.invalid} |`,
    `| Village | ${report.villages.inserted} | ${report.villages.updated} | ${report.villages.skipped} | ${report.villages.invalid} |`,
    "",
    "## Summary",
    "",
    `- Missing parent: ${report.summary.missingParent}`,
    `- Invalid coordinates: ${report.summary.invalidCoordinate}`,
    `- Duplicate names skipped: ${report.summary.duplicateNamesSkipped}`,
    "",
    "## Notes",
    "",
    ...report.notes.map((n) => `- ${n}`),
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(docsReport), { recursive: true });
  fs.writeFileSync(docsReport, md, "utf8");

  return report;
}
