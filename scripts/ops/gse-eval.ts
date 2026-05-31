/**
 * Golden Set Evaluation (GSE) runner — VRE retrieval or AI Doctor pipeline.
 *
 * Usage:
 *   npx tsx scripts/ops/gse-eval.ts --target=ai-doctor --corpus=ai-doctor-g1-v1
 *   npx tsx scripts/ops/gse-eval.ts --target=vre --corpus=farmer-bn-g1-v1
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma } from '../../src/shared/database/prisma.js';
import { getKnowledgeRetrievalService } from '../../src/modules/ai/knowledge-retrieval/knowledge-retrieval.service.js';
import { normalizeQueryForRetrieval } from '../../src/modules/ai/knowledge-retrieval/query/query-normalizer.service.js';
import { setVreConfigForTests } from '../../src/modules/ai/knowledge-retrieval/config/vre-config.js';
import type { GoldenEvalRecord } from '../../src/modules/ai/knowledge-retrieval/eval/golden-set.types.js';
import {
  compositeScoresFromSummary,
  evaluateGseRecord,
  summarizeGseEval,
} from '../../src/modules/ai/knowledge-retrieval/eval/gse-evaluator.service.js';
import {
  runAiDoctorGoldenEval,
  summarizeAiDoctorEval,
  type AiDoctorEvalRow,
} from '../../src/modules/ai/knowledge-retrieval/eval/ai-doctor-eval.runner.js';
import type { GseEvalResult } from '../../src/modules/ai/knowledge-retrieval/eval/golden-set.types.js';
import type { AiDbTaskType } from '../../src/modules/ai/routing/ai-task.types.js';

const root = join(import.meta.dirname, '../..');

function parseArg(prefix: string, fallback: string): string {
  const arg = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return arg?.split('=')[1] ?? fallback;
}

const target = parseArg('--target', 'ai-doctor');
const corpusName = parseArg('--corpus', target === 'ai-doctor' ? 'ai-doctor-g1-v1' : 'farmer-bn-g1-v1');
const corpusPath = join(root, 'eval/corpora', `${corpusName}.json`);
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as GoldenEvalRecord[];

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const prisma = getPrisma();
const publishedChunks = await prisma.aiKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });
const corpusUnavailable = publishedChunks === 0;

if (corpusUnavailable) {
  console.log('Note: no published chunks — retrieval precision relaxed; routing/safety still evaluated.\n');
}

setVreConfigForTests({
  colloquialExpansionEnabled: true,
  crossEncoderRerankEnabled: true,
  postLlmValidationEnabled: true,
  retrievalMetadataLoggingEnabled: true,
  pgvectorAnnEnabled: true,
  evalLexicalOnly: false,
});

console.log(`GSE Eval — target=${target} corpus=${corpusName} (${corpus.length} queries)\n`);

type EvalRow = {
  id: string;
  query: string;
  gse: GseEvalResult | AiDoctorEvalRow;
  chunkCount?: number;
  caseScore?: number;
  latencyMs?: number;
};

const rows: EvalRow[] = [];

if (target === 'ai-doctor') {
  for (const query of corpus) {
    try {
      const row = await runAiDoctorGoldenEval({
        query,
        options: { corpusUnavailable },
      });
      rows.push({
        id: query.id,
        query: query.query,
        gse: row,
        chunkCount: row.chunkCount,
        caseScore: row.caseScore,
        latencyMs: row.latencyMs,
      });
      const status = row.passed ? 'PASS' : 'FAIL';
      console.log(
        `[${status}] ${query.id} composite=${row.compositeScore} case=${row.caseScore.toFixed(2)} tier=${row.confidenceTier} p@4=${row.precisionAt4.toFixed(2)} chunks=${row.chunkCount} ${row.latencyMs}ms`,
      );
      if (row.violations.length) {
        console.log(`       violations: ${row.violations.join('; ')}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[ERROR] ${query.id}: ${message}`);
    }
  }
} else {
  const service = getKnowledgeRetrievalService();
  for (const query of corpus) {
    try {
      const normalized = normalizeQueryForRetrieval({ query: query.query, locale: query.locale });
      const pack = await service.retrieve({
        query: query.query,
        locale: query.locale,
        taskType: query.taskType as AiDbTaskType,
        profileId: query.profileId,
      });
      const gse = evaluateGseRecord({
        query,
        pack,
        corpusUnavailable,
      });
      rows.push({
        id: query.id,
        query: query.query,
        gse,
        chunkCount: pack.chunks.length,
        latencyMs: pack.scores.totalMs,
      });
      const status = gse.passed ? 'PASS' : 'FAIL';
      console.log(
        `[${status}] ${query.id} composite=${gse.compositeScore} routing=${gse.actualRouting} p@4=${gse.precisionAt4.toFixed(2)} chunks=${pack.chunks.length}`,
      );
      if (gse.violations.length) {
        console.log(`       violations: ${gse.violations.join('; ')}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[ERROR] ${query.id}: ${message}`);
    }
  }
}

const gseResults = rows.map((r) => r.gse);
const summary = summarizeGseEval(gseResults);
const scores = compositeScoresFromSummary(summary);
const aiDoctorSummary =
  target === 'ai-doctor'
    ? summarizeAiDoctorEval(rows.map((r) => r.gse as AiDoctorEvalRow))
    : undefined;

const report = {
  target,
  corpus: corpusName,
  evaluatedAt: new Date().toISOString(),
  corpusUnavailable,
  publishedChunks,
  summary,
  scores,
  aiDoctorSummary,
  dimensionBreakdown: summary.dimensionAverages,
  rows: rows.map((r) => ({
    id: r.id,
    query: r.query,
    passed: r.gse.passed,
    compositeScore: r.gse.compositeScore,
    dimensions: r.gse.dimensions,
    violations: r.gse.violations,
    actualRouting: r.gse.actualRouting,
    precisionAt4: r.gse.precisionAt4,
    chunkCount: r.chunkCount,
    caseScore: r.caseScore,
    latencyMs: r.latencyMs,
  })),
};

const outDir = join(root, 'reports');
mkdirSync(outDir, { recursive: true });
const outName = target === 'ai-doctor' ? 'gse-ai-doctor-eval-latest.json' : 'gse-eval-latest.json';
const outPath = join(outDir, outName);
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log('\n--- Summary ---');
console.log(JSON.stringify({ summary, scores, aiDoctorSummary }, null, 2));
console.log(`\nReport written: ${outPath}`);

const passThreshold = target === 'ai-doctor' ? 0.5 : 0.7;
process.exitCode = summary.passRate >= passThreshold ? 0 : 1;
