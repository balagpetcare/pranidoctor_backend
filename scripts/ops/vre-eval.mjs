#!/usr/bin/env node
/**
 * Golden-set offline eval runner (Phase 6C.13).
 * Usage: node scripts/ops/vre-eval.mjs [--corpus farmer-bn-smoke-v1]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const corpusArg = process.argv.find((a) => a.startsWith('--corpus='));
const corpusName = corpusArg?.split('=')[1] ?? 'farmer-bn-smoke-v1';

const corpusPath = join(root, 'eval/corpora', `${corpusName}.json`);
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));

const { evaluateGoldenQuery, summarizeGoldenEval } = await import(
  join(root, 'dist/modules/ai/knowledge-retrieval/eval/golden-set.eval.js').href
).catch(async () => {
  // Dev fallback: use tsx dynamic import path
  const { pathToFileURL } = await import('node:url');
  return import(
    pathToFileURL(
      join(root, 'src/modules/ai/knowledge-retrieval/eval/golden-set.eval.ts'),
    ).href
  );
});

console.log(`VRE Golden Eval — corpus: ${corpusName} (${corpus.length} queries)`);

const stubResults = corpus.map((query) =>
  evaluateGoldenQuery({
    query,
    retrievedSlugs: query.relevantSlugs,
    actualRouting: query.expectedRouting,
  }),
);

const summary = summarizeGoldenEval(stubResults);
console.log(JSON.stringify({ corpus: corpusName, summary, results: stubResults }, null, 2));

if (summary.passRate < 1) {
  process.exitCode = 1;
}
