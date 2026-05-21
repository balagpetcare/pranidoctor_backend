import { getAreaCacheService } from '../src/modules/area-engine/cache/area-cache.service.js';
import { applyAreaEngineSeed, getAreaSeedVersion } from './area-seed-lib.js';
import { importLocationSheet } from './location/lib/import-location-sheet.js';
import { bootstrapScriptRuntime, shutdownScriptRuntime } from './seed-runtime.js';

async function main(): Promise<void> {
  const { logger, prisma } = bootstrapScriptRuntime();

  await importLocationSheet(prisma);
  const result = await applyAreaEngineSeed(prisma);
  const recorded = await getAreaSeedVersion(prisma);

  try {
    await getAreaCacheService().invalidateAll();
  } catch {
    // optional
  }

  logger.info({ msg: 'Area seed applied', result });
  logger.info({ msg: 'Area seed version recorded', recorded });

  await shutdownScriptRuntime();
}

main().catch(async (error) => {
  try {
    const { getLogger } = await import('../src/shared/logger/logger.js');
    getLogger().error({
      msg: 'Area seed failed',
      error: error instanceof Error ? error.message : String(error),
    });
  } catch {
    console.error('[area:seed] failed', error);
  }
  await shutdownScriptRuntime().catch(() => undefined);
  process.exit(1);
});
