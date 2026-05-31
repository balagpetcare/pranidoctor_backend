/**
 * UVKG Knowledge Expansion Wave — population only (no sync / architecture changes).
 *
 * Usage:
 *   npx tsx scripts/knowledge/uvkg-wave/uvkg-wave-expand.ts
 *   npx tsx scripts/knowledge/uvkg-wave/uvkg-wave-expand.ts --waves=1,2,3
 *   npx tsx scripts/knowledge/uvkg-wave/uvkg-wave-expand.ts --skip-validation
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { bootstrapScriptRuntime, shutdownScriptRuntime } from '../../seed-runtime.js';
import { getPhase4ValidationService } from '../../../src/modules/ai/uvkg/services/phase4-validation.service.js';
import { getKnowledgeLinkRepository } from '../../../src/modules/ai/uvkg/repositories/knowledge-link.repository.js';
import { mergeStats } from './uvkg-link-writer.js';
import { runWave1DiseaseExpansion } from './wave1-disease.js';
import { runWave2MedicineExpansion } from './wave2-medicine.js';
import { runWave3FeedExpansion } from './wave3-feed.js';
import { runWave4VaccineExpansion } from './wave4-vaccine.js';
import { runWave5OutbreakExpansion } from './wave5-outbreak.js';
import { WAVE1_DISEASE_CATALOG } from './data/wave1-disease-catalog.js';
import { buildWave2MedicineCatalog } from './data/wave2-medicine-catalog.js';

bootstrapScriptRuntime();

const args = process.argv.slice(2);
const skipValidation = args.includes('--skip-validation');
const validateOnly = args.includes('--validate-only');
const wavesArg = args.find((a) => a.startsWith('--waves='));
const selectedWaves = wavesArg
  ? new Set(wavesArg.split('=')[1]!.split(',').map((w) => w.trim()))
  : new Set(['1', '2', '3', '4', '5']);

const outputPath = resolve('docs/audits/uvkg-wave1-report.md');

async function main(): Promise<void> {
  const repo = getKnowledgeLinkRepository();
  const beforeEdges = await repo.countAll();
  const beforeEntities = Math.max(
    await repo.countDistinctEndpointRefs(),
    await repo.countVkKnowledgeEntities(),
  );

  console.log('UVKG Knowledge Expansion Wave');
  console.log(`  Before: ${beforeEdges} edges, ${beforeEntities} entities`);
  console.log(`  Waves: ${validateOnly ? '(validate only)' : [...selectedWaves].join(', ')}`);

  const waveResults: Record<string, { written: number; skipped: number; errors: string[] }> = {};

  if (!validateOnly && selectedWaves.has('1')) {
    console.log('\nWave 1 — Disease…');
    waveResults.wave1 = await runWave1DiseaseExpansion();
    console.log(`  written=${waveResults.wave1.written} skipped=${waveResults.wave1.skipped}`);
  }
  if (!validateOnly && selectedWaves.has('2')) {
    console.log('\nWave 2 — Medicine…');
    waveResults.wave2 = await runWave2MedicineExpansion();
    console.log(`  written=${waveResults.wave2.written} skipped=${waveResults.wave2.skipped}`);
  }
  if (!validateOnly && selectedWaves.has('3')) {
    console.log('\nWave 3 — Feed…');
    waveResults.wave3 = await runWave3FeedExpansion();
    console.log(`  written=${waveResults.wave3.written} skipped=${waveResults.wave3.skipped}`);
  }
  if (!validateOnly && selectedWaves.has('4')) {
    console.log('\nWave 4 — Vaccine…');
    waveResults.wave4 = await runWave4VaccineExpansion();
    console.log(`  written=${waveResults.wave4.written} skipped=${waveResults.wave4.skipped}`);
  }
  if (!validateOnly && selectedWaves.has('5')) {
    console.log('\nWave 5 — Outbreak…');
    waveResults.wave5 = await runWave5OutbreakExpansion();
    console.log(`  written=${waveResults.wave5.written} skipped=${waveResults.wave5.skipped}`);
  }

  const merged = mergeStats(...Object.values(waveResults));
  const afterEdges = await repo.countAll();
  const afterEntities = Math.max(
    await repo.countDistinctEndpointRefs(),
    await repo.countVkKnowledgeEntities(),
  );

  let coverageScore = 0;
  let readinessScore = 0;
  let coverageTargetsMet = false;
  let readinessForPhase5 = false;
  const blockers: string[] = [];

  if (validateOnly || !skipValidation) {
    console.log('\nRunning coverage & quality validation…');
    const report = await getPhase4ValidationService().runFullValidation({ skipPopulation: true });
    const metCategories = report.coverage.categories.filter((c) => c.met).length;
    coverageScore = Math.round(
      (metCategories / Math.max(report.coverage.categories.length, 1)) * 100,
    );
    readinessScore = report.readinessScore;
    coverageTargetsMet = report.coverage.targetsMet;
    readinessForPhase5 = report.readinessForPhase5;
    blockers.push(...report.blockers);
  }

  const medicineCount = buildWave2MedicineCatalog().length;
  const markdown = formatWaveReport({
    generatedAt: new Date().toISOString(),
    beforeEdges,
    beforeEntities,
    afterEdges,
    afterEntities,
    waveResults,
    merged,
    diseaseCatalogCount: WAVE1_DISEASE_CATALOG.length,
    medicineCatalogCount: medicineCount,
    coverageScore,
    readinessScore,
    coverageTargetsMet,
    readinessForPhase5,
    blockers,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, 'utf8');

  console.log('\n--- Wave expansion complete ---');
  console.log(
    JSON.stringify(
      {
        afterEdges,
        afterEntities,
        linksWritten: merged.written,
        linksSkipped: merged.skipped,
        coverageScore,
        readinessScore,
        reportPath: outputPath,
      },
      null,
      2,
    ),
  );

  await shutdownScriptRuntime();
}

function formatWaveReport(input: {
  generatedAt: string;
  beforeEdges: number;
  beforeEntities: number;
  afterEdges: number;
  afterEntities: number;
  waveResults: Record<string, { written: number; skipped: number; errors: string[] }>;
  merged: { written: number; skipped: number; errors: string[] };
  diseaseCatalogCount: number;
  medicineCatalogCount: number;
  coverageScore: number;
  readinessScore: number;
  coverageTargetsMet: boolean;
  readinessForPhase5: boolean;
  blockers: string[];
}): string {
  const targets = { minEntities: 1000, minEdges: 10000 };
  const entitiesMet = input.afterEntities >= targets.minEntities;
  const edgesMet = input.afterEdges >= targets.minEdges;

  const waveRows = Object.entries(input.waveResults)
    .map(
      ([w, s]) =>
        `| ${w} | ${s.written} | ${s.skipped} | ${s.errors.length > 0 ? s.errors.slice(0, 3).join('; ') : '—'} |`,
    )
    .join('\n');

  return `# UVKG Knowledge Expansion Wave Report

Generated: ${input.generatedAt}

## Executive summary

| Metric | Before | After | Target | Met |
|--------|--------|-------|--------|-----|
| Entities | ${input.beforeEntities} | **${input.afterEntities}** | ≥ ${targets.minEntities} | ${entitiesMet ? '✅' : '❌'} |
| Edges | ${input.beforeEdges} | **${input.afterEdges}** | ≥ ${targets.minEdges} | ${edgesMet ? '✅' : '❌'} |
| Coverage score | — | **${input.coverageScore}%** | — | ${input.coverageTargetsMet ? '✅' : '⚠️'} |
| Readiness score | — | **${input.readinessScore}/100** | Phase 5 gate | ${input.readinessForPhase5 ? '✅ READY' : '❌ NOT_READY'} |

## Wave execution

| Wave | Links written | Skipped | Sample errors |
|------|---------------|---------|---------------|
${waveRows || '| (none run) | — | — | — |'}

**Total this run:** ${input.merged.written} written, ${input.merged.skipped} skipped.

## Catalog counts

| Domain | Catalog entities |
|--------|------------------|
| Diseases (Wave 1) | ${input.diseaseCatalogCount} |
| Medicine generics (Wave 2) | ${input.medicineCatalogCount} |

## Constraints honored

- UVKG architecture unchanged
- Sync logic unchanged (\`graph-sync.service\` not modified)
- \`UVKG_READ_ENABLED\` remains **false** — no UVKG reads enabled
- All wave links created as **DRAFT** via direct \`VkKnowledgeLink\` upsert

## Validation blockers

${input.blockers.length ? input.blockers.map((b) => `- ${b}`).join('\n') : '_None reported._'}

## Sample errors (max 20)

${input.merged.errors.length ? input.merged.errors.slice(0, 20).map((e) => `- ${e}`).join('\n') : '_None._'}

---
_Report generated by \`scripts/knowledge/uvkg-wave/uvkg-wave-expand.ts\`._
`;
}

main().catch(async (err) => {
  console.error(err);
  await shutdownScriptRuntime().catch(() => undefined);
  process.exit(1);
});
