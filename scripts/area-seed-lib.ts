import type { PrismaClient } from '../../src/generated/prisma/client.js';

import { seedBdReferenceLocations } from '../prisma/seed-data/bd-locations.js';
import { upsertVillageByTrimmedCode } from '../prisma/seed-data/location-trim-upserts.js';

export const AREA_SEED_VERSION = '2026.05.21-area-engine-1';

export const AREA_ENGINE_VILLAGE_ROWS = [
  {
    slug: 'kazulia-village-gopalganj',
    unionSlug: 'kazulia-union-gopalganj',
    nameBn: 'কাজুলিয়া',
    nameEn: 'Kazulia',
    code: '3035184701',
  },
] as const;

const SETTING_KEY = 'area_engine.seed_version';

export async function applyAreaEngineSeed(prisma: PrismaClient): Promise<{
  version: string;
  villagesSeeded: number;
}> {
  await seedBdReferenceLocations(prisma);

  const unionBySlug = new Map<string, { id: string }>();
  const unions = await prisma.union.findMany({
    where: {
      slug: { in: AREA_ENGINE_VILLAGE_ROWS.map((r) => r.unionSlug) },
    },
    select: { id: true, slug: true },
  });
  for (const u of unions) {
    unionBySlug.set(u.slug, { id: u.id });
  }

  let villagesSeeded = 0;
  for (const row of AREA_ENGINE_VILLAGE_ROWS) {
    const union = unionBySlug.get(row.unionSlug);
    if (!union) continue;
    await upsertVillageByTrimmedCode(prisma, {
      unionId: union.id,
      slug: row.slug,
      name: row.nameEn,
      nameBn: row.nameBn,
      nameEn: row.nameEn,
      code: row.code,
      isActive: true,
    });
    villagesSeeded += 1;
  }

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: {
      key: SETTING_KEY,
      valueJson: {
        version: AREA_SEED_VERSION,
        appliedAt: new Date().toISOString(),
      },
    },
    update: {
      valueJson: {
        version: AREA_SEED_VERSION,
        appliedAt: new Date().toISOString(),
      },
    },
  });

  return { version: AREA_SEED_VERSION, villagesSeeded };
}

export async function getAreaSeedVersion(
  prisma: PrismaClient,
): Promise<{ version: string; appliedAt: string } | null> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.valueJson || typeof row.valueJson !== 'object') return null;
  const v = row.valueJson as Record<string, unknown>;
  if (typeof v.version !== 'string' || typeof v.appliedAt !== 'string') return null;
  return { version: v.version, appliedAt: v.appliedAt };
}
