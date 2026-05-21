import { loadEnvironment } from '../src/shared/config/load-env.js';

loadEnvironment();

import { createPrismaClient, disconnectPrisma, getPrisma } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/index.js';
import { getAreaCacheService } from '../src/modules/area-engine/cache/area-cache.service.js';
import { applyAreaEngineSeed, getAreaSeedVersion } from './area-seed-lib.js';

async function main(): Promise<void> {
  const config = loadConfig();
  createPrismaClient({ config });
  const prisma = getPrisma();

  const result = await applyAreaEngineSeed(prisma);
  const recorded = await getAreaSeedVersion(prisma);

  try {
    await getAreaCacheService().invalidateAll();
  } catch {
    // optional
  }

  console.log('[area:seed] applied', result);
  console.log('[area:seed] recorded', recorded);

  await disconnectPrisma();
}

main().catch((error) => {
  console.error('[area:seed] failed', error);
  process.exit(1);
});
