import { getPrisma } from '../../shared/database/prisma.js';

import { parsePointValues, type PointValues } from './points.rules.js';
import { parseFreeZonePolicy, type FreeZonePolicy } from './free-zone.rules.js';

export const FREE_ZONE_POLICY_KEY = 'FREE_ZONE_POLICY';

export async function getFreeZonePolicy(): Promise<FreeZonePolicy> {
  const row = await getPrisma().setting.findUnique({ where: { key: FREE_ZONE_POLICY_KEY }, select: { valueJson: true } });
  return parseFreeZonePolicy(row?.valueJson);
}

export async function saveFreeZonePolicy(input: FreeZonePolicy): Promise<FreeZonePolicy> {
  const clean = parseFreeZonePolicy(input);
  await getPrisma().setting.upsert({
    where: { key: FREE_ZONE_POLICY_KEY },
    create: { key: FREE_ZONE_POLICY_KEY, valueJson: { ...clean } },
    update: { valueJson: { ...clean } },
  });
  return clean;
}

export const FREE_ZONE_POINTS_KEY = 'FREE_ZONE_POINTS';

export async function getPointValues(): Promise<PointValues> {
  const row = await getPrisma().setting.findUnique({ where: { key: FREE_ZONE_POINTS_KEY }, select: { valueJson: true } });
  return parsePointValues(row?.valueJson);
}

export async function savePointValues(input: PointValues): Promise<PointValues> {
  const clean = parsePointValues(input);
  await getPrisma().setting.upsert({
    where: { key: FREE_ZONE_POINTS_KEY },
    create: { key: FREE_ZONE_POINTS_KEY, valueJson: { ...clean } },
    update: { valueJson: { ...clean } },
  });
  return clean;
}
