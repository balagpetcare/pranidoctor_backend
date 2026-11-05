/**
 * Builds the Area hierarchy from the normalized location master
 * (Division → District → Upazila → Union → Village).
 *
 * - Idempotent: each location row maps to one Area with slug `loc-<level>-<locationId>`.
 * - Re-running updates names/codes/parent links but NEVER changes `isActive`
 *   (admin controls on/off after the first sync).
 * - New rows are active only for the pilot district (default: Gopalganj) and its
 *   parent division, so launch is limited by area selection, not by features.
 */
import { AreaType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_PILOT_DISTRICTS = ["Gopalganj"] as const;

export type SyncAreasOptions = {
  pilotDistrictNames?: readonly string[];
};

export type SyncLevelCounts = { created: number; updated: number; total: number };

export type SyncAreasReport = {
  division: SyncLevelCounts;
  district: SyncLevelCounts;
  upazila: SyncLevelCounts;
  union: SyncLevelCounts;
  village: SyncLevelCounts;
  pilotDistricts: string[];
  createdActive: number;
};

type LocRow = {
  id: string;
  name: string;
  nameBn: string | null;
  code: string | null;
  sortOrder: number;
};

type Existing = {
  id: string;
  slug: string;
  name: string;
  nameBn: string | null;
  code: string | null;
  sortOrder: number;
  parentId: string | null;
  type: AreaType;
};

const emptyCounts = (): SyncLevelCounts => ({ created: 0, updated: 0, total: 0 });

function slugFor(level: string, locationId: string): string {
  return `loc-${level}-${locationId.toLowerCase()}`;
}

function normalizePilot(names: readonly string[]): Set<string> {
  return new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
}

/**
 * Upserts one level of Areas. Returns map locationId → areaId for children.
 */
async function syncLevel(args: {
  type: AreaType;
  slugPrefix: string;
  rows: Array<LocRow & { parentAreaId: string | null; active: boolean }>;
  existingBySlug: Map<string, Existing>;
  counts: SyncLevelCounts;
  createdActiveRef: { n: number };
}): Promise<Map<string, string>> {
  const { type, slugPrefix, rows, existingBySlug, counts } = args;
  const out = new Map<string, string>();
  const toCreate: Array<{
    name: string;
    nameBn: string | null;
    slug: string;
    code: string | null;
    type: AreaType;
    parentId: string | null;
    sortOrder: number;
    isActive: boolean;
    _locId: string;
  }> = [];

  for (const row of rows) {
    counts.total += 1;
    const slug = slugFor(slugPrefix, row.id);
    const found = existingBySlug.get(slug);
    if (found) {
      out.set(row.id, found.id);
      const changed =
        found.name !== row.name ||
        found.nameBn !== row.nameBn ||
        found.code !== row.code ||
        found.sortOrder !== row.sortOrder ||
        found.parentId !== row.parentAreaId ||
        found.type !== type;
      if (changed) {
        await prisma.area.update({
          where: { id: found.id },
          data: {
            name: row.name,
            nameBn: row.nameBn,
            code: row.code,
            sortOrder: row.sortOrder,
            parentId: row.parentAreaId,
            type,
          },
        });
        counts.updated += 1;
      }
      continue;
    }
    toCreate.push({
      name: row.name,
      nameBn: row.nameBn,
      slug,
      code: row.code,
      type,
      parentId: row.parentAreaId,
      sortOrder: row.sortOrder,
      isActive: row.active,
      _locId: row.id,
    });
  }

  // Create in chunks; parent ids are already known (created in earlier levels).
  const CHUNK = 500;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const chunk = toCreate.slice(i, i + CHUNK);
    const created = await prisma.area.createManyAndReturn({
      data: chunk.map(({ _locId: _ignored, ...data }) => data),
      select: { id: true, slug: true },
    });
    const bySlug = new Map(created.map((c) => [c.slug, c.id]));
    for (const item of chunk) {
      const id = bySlug.get(slugFor(slugPrefix, item._locId));
      if (!id) throw new Error(`Area create did not return a row for ${slugFor(slugPrefix, item._locId)}`);
      out.set(item._locId, id);
      counts.created += 1;
      if (item.isActive) args.createdActiveRef.n += 1;
    }
  }
  return out;
}

export async function syncAreasFromLocations(options: SyncAreasOptions = {}): Promise<SyncAreasReport> {
  const pilotNames = options.pilotDistrictNames ?? DEFAULT_PILOT_DISTRICTS;
  const pilot = normalizePilot(pilotNames);

  const existing = await prisma.area.findMany({
    where: { slug: { startsWith: "loc-" } },
    select: { id: true, slug: true, name: true, nameBn: true, code: true, sortOrder: true, parentId: true, type: true },
  });
  const existingBySlug = new Map<string, Existing>(existing.map((a) => [a.slug, a]));

  const [divisions, districts, upazilas, unions, villages] = await Promise.all([
    prisma.division.findMany({ select: { id: true, name: true, nameBn: true, nameEn: true, code: true, sortOrder: true } }),
    prisma.district.findMany({ select: { id: true, divisionId: true, name: true, nameBn: true, nameEn: true, code: true, sortOrder: true } }),
    prisma.upazila.findMany({ select: { id: true, districtId: true, name: true, nameBn: true, nameEn: true, code: true, sortOrder: true } }),
    prisma.union.findMany({ select: { id: true, upazilaId: true, name: true, nameBn: true, nameEn: true, code: true, sortOrder: true } }),
    prisma.village.findMany({ select: { id: true, unionId: true, name: true, nameBn: true, nameEn: true, code: true } }),
  ]);

  const isPilotName = (n: string | null | undefined, en?: string | null) =>
    pilot.has((n ?? '').trim().toLowerCase()) || (en ? pilot.has(en.trim().toLowerCase()) : false);

  const pilotDistrictIds = new Set(districts.filter((d) => isPilotName(d.name, d.nameEn)).map((d) => d.id));
  const pilotDivisionIds = new Set(districts.filter((d) => pilotDistrictIds.has(d.id)).map((d) => d.divisionId));
  const pilotUpazilaIds = new Set(upazilas.filter((u) => pilotDistrictIds.has(u.districtId)).map((u) => u.id));
  const pilotUnionIds = new Set(unions.filter((u) => pilotUpazilaIds.has(u.upazilaId)).map((u) => u.id));

  const names = (r: { name: string; nameBn: string | null; nameEn?: string | null }) => ({
    name: (r.nameEn ?? r.name).trim() || r.name,
    nameBn: r.nameBn ?? null,
  });

  const report: SyncAreasReport = {
    division: emptyCounts(),
    district: emptyCounts(),
    upazila: emptyCounts(),
    union: emptyCounts(),
    village: emptyCounts(),
    pilotDistricts: [...pilot],
    createdActive: 0,
  };
  const createdActiveRef = { n: 0 };

  const divIds = await syncLevel({
    type: AreaType.DIVISION,
    slugPrefix: 'div',
    rows: divisions.map((d) => ({ id: d.id, ...names(d), code: d.code, sortOrder: d.sortOrder, parentAreaId: null, active: pilotDivisionIds.has(d.id) })),
    existingBySlug,
    counts: report.division,
    createdActiveRef,
  });

  const disIds = await syncLevel({
    type: AreaType.DISTRICT,
    slugPrefix: 'dis',
    rows: districts.map((d) => ({ id: d.id, ...names(d), code: d.code, sortOrder: d.sortOrder, parentAreaId: divIds.get(d.divisionId) ?? null, active: pilotDistrictIds.has(d.id) })),
    existingBySlug,
    counts: report.district,
    createdActiveRef,
  });

  const upzIds = await syncLevel({
    type: AreaType.UPAZILA,
    slugPrefix: 'upz',
    rows: upazilas.map((u) => ({ id: u.id, ...names(u), code: u.code, sortOrder: u.sortOrder, parentAreaId: disIds.get(u.districtId) ?? null, active: pilotUpazilaIds.has(u.id) })),
    existingBySlug,
    counts: report.upazila,
    createdActiveRef,
  });

  const uniIds = await syncLevel({
    type: AreaType.UNION,
    slugPrefix: 'uni',
    rows: unions.map((u) => ({ id: u.id, ...names(u), code: u.code, sortOrder: u.sortOrder, parentAreaId: upzIds.get(u.upazilaId) ?? null, active: pilotUnionIds.has(u.id) })),
    existingBySlug,
    counts: report.union,
    createdActiveRef,
  });

  await syncLevel({
    type: AreaType.VILLAGE,
    slugPrefix: 'vil',
    rows: villages.map((v) => ({ id: v.id, ...names(v), code: v.code, sortOrder: 0, parentAreaId: uniIds.get(v.unionId) ?? null, active: pilotUnionIds.has(v.unionId) })),
    existingBySlug,
    counts: report.village,
    createdActiveRef,
  });

  report.createdActive = createdActiveRef.n;
  return report;
}
