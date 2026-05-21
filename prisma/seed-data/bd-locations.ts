/**
 * Bangladesh reference geography for `Division` → `District` → `Upazila` → `Union`.
 * Append rows here to grow the dataset without structural changes.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";

import {
  upsertDistrictByTrimmedCode,
  upsertUnionByTrimmedCode,
  upsertUpazilaByTrimmedCode,
} from "./location-trim-upserts";

/** Division rows keyed by stable `slug` (must match `Division.slug`). */
export const BD_DIVISION_PATCHES = [
  {
    slug: "dhaka-division-geo",
    nameBn: "ঢাকা বিভাগ",
    nameEn: "Dhaka Division",
    code: "30",
    sortOrder: 10,
  },
] as const;

export const BD_DISTRICT_ROWS = [
  {
    slug: "gopalganj-district",
    divisionSlug: "dhaka-division-geo",
    nameBn: "গোপালগঞ্জ",
    nameEn: "Gopalganj",
    code: "3035",
    sortOrder: 35,
  },
  {
    slug: "tangail-district",
    divisionSlug: "dhaka-division-geo",
    nameBn: "টাঙ্গাইল",
    nameEn: "Tangail",
    /// BBS-style code; must not collide with `gazipur-district` (`3033`) under the same division (trim-code unique index).
    code: "3034",
    sortOrder: 33,
  },
  {
    slug: "faridpur-district",
    divisionSlug: "dhaka-division-geo",
    nameBn: "ফরিদপুর",
    nameEn: "Faridpur",
    code: "3029",
    sortOrder: 29,
  },
] as const;

export const BD_UPAZILA_ROWS = [
  {
    slug: "gopalganj-sadar-upazila",
    districtSlug: "gopalganj-district",
    nameBn: "গোপালগঞ্জ সদর",
    nameEn: "Gopalganj Sadar",
    code: "303518",
    sortOrder: 10,
  },
  {
    slug: "tangail-sadar-upazila",
    districtSlug: "tangail-district",
    nameBn: "টাঙ্গাইল সদর",
    nameEn: "Tangail Sadar",
    code: "303418",
    sortOrder: 10,
  },
  {
    slug: "faridpur-sadar-upazila",
    districtSlug: "faridpur-district",
    nameBn: "ফরিদপুর সদর",
    nameEn: "Faridpur Sadar",
    code: "302918",
    sortOrder: 10,
  },
] as const;

export const BD_UNION_ROWS = [
  {
    slug: "kazulia-union-gopalganj",
    upazilaSlug: "gopalganj-sadar-upazila",
    nameBn: "কাজুলিয়া",
    nameEn: "Kazulia",
    code: "30351847",
    sortOrder: 10,
  },
  {
    slug: "kagmari-union-tangail",
    upazilaSlug: "tangail-sadar-upazila",
    nameBn: "কাগমারী",
    nameEn: "Kagmari",
    code: "30341801",
    sortOrder: 11,
  },
  {
    slug: "aliabad-union-faridpur",
    upazilaSlug: "faridpur-sadar-upazila",
    nameBn: "আলিয়াবাদ",
    nameEn: "Aliabad",
    code: "30291801",
    sortOrder: 12,
  },
] as const;

/**
 * Idempotent reference seed — safe to run on every `prisma db seed`.
 * Patches existing `Division` rows and upserts sample districts (incl. Gopalganj / Sadar / Kazulia).
 */
export async function seedBdReferenceLocations(prisma: PrismaClient): Promise<void> {
  for (const d of BD_DIVISION_PATCHES) {
    await prisma.division.upsert({
      where: { slug: d.slug },
      create: {
        slug: d.slug,
        name: d.nameEn,
        nameBn: d.nameBn,
        nameEn: d.nameEn,
        code: d.code ?? null,
        sortOrder: d.sortOrder ?? 0,
        isActive: true,
      },
      update: {
        nameBn: d.nameBn,
        nameEn: d.nameEn,
        code: d.code ?? undefined,
        sortOrder: d.sortOrder ?? undefined,
        isActive: true,
      },
    });
  }

  const divisionBySlug = new Map<string, { id: string }>();
  const divisions = await prisma.division.findMany({
    where: { slug: { in: [...new Set(BD_DISTRICT_ROWS.map((r) => r.divisionSlug))] } },
    select: { id: true, slug: true },
  });
  for (const row of divisions) {
    divisionBySlug.set(row.slug, { id: row.id });
  }

  const districtBySlug = new Map<string, { id: string }>();

  for (const row of BD_DISTRICT_ROWS) {
    const div = divisionBySlug.get(row.divisionSlug);
    if (!div) {
      console.warn(
        `[seed-bd-locations] Skipping district ${row.slug}: division ${row.divisionSlug} not found`,
      );
      continue;
    }
    const label = row.nameEn;
    const dist = await upsertDistrictByTrimmedCode(prisma, {
      divisionId: div.id,
      slug: row.slug,
      name: label,
      nameBn: row.nameBn,
      nameEn: row.nameEn,
      code: row.code ?? null,
      sortOrder: row.sortOrder ?? 0,
      isActive: true,
    });
    districtBySlug.set(row.slug, { id: dist.id });
  }

  const upazilaBySlug = new Map<string, { id: string }>();

  for (const row of BD_UPAZILA_ROWS) {
    const dist = districtBySlug.get(row.districtSlug);
    if (!dist) {
      console.warn(
        `[seed-bd-locations] Skipping upazila ${row.slug}: district ${row.districtSlug} not found`,
      );
      continue;
    }
    const label = row.nameEn;
    const up = await upsertUpazilaByTrimmedCode(prisma, {
      districtId: dist.id,
      slug: row.slug,
      name: label,
      nameBn: row.nameBn,
      nameEn: row.nameEn,
      code: row.code ?? null,
      sortOrder: row.sortOrder ?? 0,
      isActive: true,
    });
    upazilaBySlug.set(row.slug, { id: up.id });
  }

  for (const row of BD_UNION_ROWS) {
    const up = upazilaBySlug.get(row.upazilaSlug);
    if (!up) {
      console.warn(
        `[seed-bd-locations] Skipping union ${row.slug}: upazila ${row.upazilaSlug} not found`,
      );
      continue;
    }
    const label = row.nameEn;
    await upsertUnionByTrimmedCode(prisma, {
      upazilaId: up.id,
      slug: row.slug,
      name: label,
      nameBn: row.nameBn,
      nameEn: row.nameEn,
      code: row.code ?? null,
      sortOrder: row.sortOrder ?? 0,
      isActive: true,
    });
  }
}
