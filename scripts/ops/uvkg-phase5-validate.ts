/**
 * UVKG Phase 5 — shadow read validation, accuracy, AI retrieval, performance, rollout.
 *
 * Usage:
 *   npx tsx scripts/ops/uvkg-phase5-validate.ts
 *   npx tsx scripts/ops/uvkg-phase5-validate.ts --output=docs/audits/uvkg-phase5-readiness.md
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, disconnectPrisma } from '../../src/shared/database/prisma.js';
import { getPhase5ValidationService } from '../../src/modules/ai/uvkg/services/phase5-validation.service.js';
import { formatPhase5ValidationMarkdown } from '../../src/modules/ai/uvkg/uvkg-report.formatter.js';

loadEnvironment();
process.env.UVKG_SHADOW_READ_ENABLED ??= 'true';
process.env.UVKG_SHADOW_INCLUDE_DRAFT ??= 'true';

resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const args = process.argv.slice(2);
const outputArg = args.find((a) => a.startsWith('--output='));
const outputPath = resolve(
  outputArg?.split('=')[1] ?? 'docs/audits/uvkg-phase5-readiness.md',
);

async function main(): Promise<void> {
  console.log('UVKG Phase 5 validation starting…');
  console.log(`  UVKG_READ_ENABLED=${process.env.UVKG_READ_ENABLED ?? 'false'}`);
  console.log(`  UVKG_SHADOW_READ_ENABLED=${process.env.UVKG_SHADOW_READ_ENABLED}`);
  console.log(`  UVKG_READ_PERCENT=${process.env.UVKG_READ_PERCENT ?? '0'}`);

  const report = await getPhase5ValidationService().runFullValidation();
  const markdown = formatPhase5ValidationMarkdown(report);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, 'utf8');

  console.log('\n--- Summary ---');
  console.log(
    JSON.stringify(
      {
        recommendation: report.recommendation,
        readinessScore: report.readinessScore,
        overallParityRatio: report.overallParityRatio,
        shadowSamples: report.shadowReads.length,
        reportPath: outputPath,
      },
      null,
      2,
    ),
  );

  await disconnectPrisma();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma().catch(() => undefined);
  process.exit(1);
});
