import { getPrisma } from '../../../shared/database/prisma.js';

export const AREA_SEED_VERSION = '2026.05.21-area-engine-1';

const SETTING_KEY = 'area_engine.seed_version';

export async function getAreaSeedVersion(): Promise<{ version: string; appliedAt: string } | null> {
  const row = await getPrisma().setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.valueJson || typeof row.valueJson !== 'object') return null;
  const v = row.valueJson as Record<string, unknown>;
  if (typeof v.version !== 'string' || typeof v.appliedAt !== 'string') return null;
  return { version: v.version, appliedAt: v.appliedAt };
}
