#!/usr/bin/env node
/**
 * Live 20-query Bangla golden-set eval against KnowledgeRetrievalService.
 * Usage: npx tsx scripts/ops/vre-golden-eval.mjs [--corpus=farmer-bn-g1-v1]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const toUrl = (rel) => pathToFileURL(join(root, rel)).href;
const corpusArg = process.argv.find((a) => a.startsWith('--corpus='));
const corpusName = corpusArg?.split('=')[1] ?? 'farmer-bn-g1-v1';

const corpusPath = join(root, 'eval/corpora', `${corpusName}.json`);
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));

const { loadConfig } = await import(toUrl('src/shared/config/config.ts'));
const { createPrismaClient } = await import(toUrl('src/shared/database/prisma.ts'));
createPrismaClient({ config: loadConfig() });

const { getKnowledgeRetrievalService } = await import(
  toUrl('src/modules/ai/knowledge-retrieval/knowledge-retrieval.service.ts')
);
const { normalizeQueryForRetrieval } = await import(
  toUrl('src/modules/ai/knowledge-retrieval/query/query-normalizer.service.ts')
);
const { evaluateGoldenLiveRow, summarizeGoldenLiveEval, scoreFromLiveEval } = await import(
  toUrl('src/modules/ai/knowledge-retrieval/eval/golden-set-live.eval.ts')
);
const { setVreConfigForTests } = await import(
  toUrl('src/modules/ai/knowledge-retrieval/config/vre-config.ts')
);

setVreConfigForTests({
  colloquialExpansionEnabled: true,
  crossEncoderRerankEnabled: true,
  postLlmValidationEnabled: true,
  retrievalMetadataLoggingEnabled: true,
  pgvectorAnnEnabled: true,
});

const service = getKnowledgeRetrievalService();
const rows = [];

console.log(`VRE Live Golden Eval — ${corpusName} (${corpus.length} queries)\n`);

for (const query of corpus) {
  try {
    const normalized = normalizeQueryForRetrieval({ query: query.query, locale: query.locale });
    const pack = await service.retrieve({
      query: query.query,
      locale: query.locale,
      taskType: query.taskType,
      profileId: query.profileId,
    });
    const row = evaluateGoldenLiveRow({
      query,
      pack,
      colloquialExpanded: normalized.colloquialExpanded,
      searchBackend: pack.retrievalMetadata?.searchBackend,
    });
    rows.push(row);
    const status = row.passed ? 'PASS' : 'FAIL';
    console.log(
      `[${status}] ${query.id} routing=${row.actualRouting} p@4=${row.precisionAt4.toFixed(2)} r@10=${row.recallAt10.toFixed(2)} chunks=${row.chunkCount} ${row.latencyMs}ms`,
    );
    if (row.violations.length) console.log(`       violations: ${row.violations.join('; ')}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[ERROR] ${query.id}: ${message}`);
    rows.push({
      queryId: query.id,
      passed: false,
      routingMatch: false,
      actualRouting: 'ERROR',
      precisionAt4: 0,
      recallAt10: 0,
      violations: [message],
      query: query.query,
      retrievedSlugs: [],
      chunkCount: 0,
      groundableChunkCount: 0,
      citationCoverage: 0,
      hasGroundingInstruction: false,
      colloquialExpanded: false,
      latencyMs: 0,
    });
  }
}

const summary = summarizeGoldenLiveEval(rows);
const scores = scoreFromLiveEval(summary);
const report = { corpus: corpusName, evaluatedAt: new Date().toISOString(), summary, scores, rows };

const outDir = join(root, 'reports');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'vre-golden-eval-latest.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log('\n--- Summary ---');
console.log(JSON.stringify({ summary, scores }, null, 2));
console.log(`\nReport written: ${outPath}`);

process.exitCode = summary.passRate >= 0.7 ? 0 : 1;
