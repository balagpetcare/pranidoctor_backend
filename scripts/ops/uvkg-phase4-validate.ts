/**
 * UVKG Phase 4 — full population, validation, and audit report generation.
 *
 * Usage:
 *   npx tsx scripts/ops/uvkg-phase4-validate.ts
 *   npx tsx scripts/ops/uvkg-phase4-validate.ts --skip-population
 *   npx tsx scripts/ops/uvkg-phase4-validate.ts --output=docs/audits/uvkg-phase4-validation.md
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, disconnectPrisma, getPrisma } from '../../src/shared/database/prisma.js';
import { getPhase4ValidationService } from '../../src/modules/ai/uvkg/services/phase4-validation.service.js';
import { formatPhase4ValidationMarkdown } from '../../src/modules/ai/uvkg/uvkg-report.formatter.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const args = process.argv.slice(2);
const skipPopulation = args.includes('--skip-population');
const resetLinks = args.includes('--reset-links');
const outputArg = args.find((a) => a.startsWith('--output='));
const outputPath = resolve(
  outputArg?.split('=')[1] ?? 'docs/audits/uvkg-phase4-validation.md',
);

async function main(): Promise<void> {
  console.log('UVKG Phase 4 validation starting…');
  console.log(`  skipPopulation=${skipPopulation}`);
  console.log(`  UVKG_READ_ENABLED=${process.env.UVKG_READ_ENABLED ?? 'false (default)'}`);

  if (resetLinks) {
    const deleted = await getPrisma().vkKnowledgeLink.deleteMany({});
    console.log(`Reset UVKG: deleted ${deleted.count} vk_knowledge_links rows`);
  }

  const report = await getPhase4ValidationService().runFullValidation({ skipPopulation });
  const markdown = formatPhase4ValidationMarkdown(report);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, 'utf8');

  console.log('\n--- Summary ---');
  console.log(JSON.stringify({
    readinessScore: report.readinessScore,
    readinessForPhase5: report.readinessForPhase5,
    totalEdges: report.coverage.totalEdges,
    totalEntities: report.coverage.totalEntities,
    blockers: report.blockers,
    reportPath: outputPath,
  }, null, 2));

  await disconnectPrisma();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma().catch(() => undefined);
  process.exit(1);
});
