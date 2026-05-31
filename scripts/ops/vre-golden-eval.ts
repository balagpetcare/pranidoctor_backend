/**
 * Live 20-query Bangla golden-set eval against KnowledgeRetrievalService.
 * Usage: npx tsx scripts/ops/vre-golden-eval.ts [--corpus=farmer-bn-g1-v1]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma } from '../../src/shared/database/prisma.js';
import { getKnowledgeRetrievalService } from '../../src/modules/ai/knowledge-retrieval/knowledge-retrieval.service.js';
import { normalizeQueryForRetrieval } from '../../src/modules/ai/knowledge-retrieval/query/query-normalizer.service.js';
import {
  evaluateGoldenLiveRow,
  summarizeGoldenLiveEval,
  scoreFromLiveEval,
} from '../../src/modules/ai/knowledge-retrieval/eval/golden-set-live.eval.js';
import type { GoldenQuery } from '../../src/modules/ai/knowledge-retrieval/eval/golden-set.eval.js';
import { setVreConfigForTests } from '../../src/modules/ai/knowledge-retrieval/config/vre-config.js';
import type { AiDbTaskType } from '../../src/modules/ai/routing/ai-task.types.js';

const root = join(import.meta.dirname, '../..');
const corpusArg = process.argv.find((a) => a.startsWith('--corpus='));
const corpusName = corpusArg?.split('=')[1] ?? 'farmer-bn-g1-v1';
const corpusPath = join(root, 'eval/corpora', `${corpusName}.json`);
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as GoldenQuery[];

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const prisma = getPrisma();
const publishedChunks = await prisma.aiKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });
const corpusUnavailable = publishedChunks === 0;
if (corpusUnavailable) {
  console.log('Note: no published chunks — retrieval metrics marked N/A; routing-only mode.\n');
}

setVreConfigForTests({
  colloquialExpansionEnabled: true,
  crossEncoderRerankEnabled: true,
  postLlmValidationEnabled: true,
  retrievalMetadataLoggingEnabled: true,
  pgvectorAnnEnabled: true,
  evalLexicalOnly: true,
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
      taskType: query.taskType as AiDbTaskType,
      profileId: query.profileId,
    });
    const row = evaluateGoldenLiveRow({
      query,
      pack,
      colloquialExpanded: normalized.colloquialExpanded,
      searchBackend: pack.retrievalMetadata?.searchBackend,
      options: { corpusUnavailable },
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
      expectedRouting: query.expectedRouting,
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
const report = {
  corpus: corpusName,
  evaluatedAt: new Date().toISOString(),
  corpusUnavailable,
  publishedChunks,
  summary,
  scores,
  rows,
};

const outDir = join(root, 'reports');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'vre-golden-eval-latest.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log('\n--- Summary ---');
console.log(JSON.stringify({ summary, scores }, null, 2));
console.log(`\nReport written: ${outPath}`);

process.exitCode = summary.passRate >= 0.7 ? 0 : 1;
