import type { PrismaClient } from '../../src/generated/prisma/client.js';

export const AREA_SEED_VERSION = '2026.05.22-sheet-location-1';

const SETTING_KEY = 'area_engine.seed_version';

/** Records area-engine seed version after sheet-based location import (no hardcoded geo). */
export async function applyAreaEngineSeed(prisma: PrismaClient): Promise<{
  version: string;
  villagesSeeded: number;
}> {
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
