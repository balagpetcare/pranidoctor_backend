import { computePrecisionAt4 } from '../golden-set.eval.js';
import type { GoldenEvalRecord } from '../golden-set.types.js';
import type { DimensionScore } from '../golden-set.types.js';
import { computeRecallAt10 } from '../golden-set-live.eval.js';

function slugMatches(retrieved: string, expected: string): boolean {
  const r = retrieved.toLowerCase();
  const e = expected.toLowerCase();
  return r.includes(e) || e.includes(r);
}

export function scoreRetrieval(params: {
  query: GoldenEvalRecord;
  retrievedSlugs: string[];
  actualRouting: string;
  corpusUnavailable?: boolean;
}): DimensionScore {
  const violations: string[] = [];
  const expectedRouting =
    params.query.expectedEscalation?.routing ?? params.query.expectedRouting;

  const routingMatch =
    params.actualRouting === expectedRouting ||
    (expectedRouting === 'PROCEED' && params.actualRouting === 'PROCEED_DEGRADED');

  if (!routingMatch) {
    violations.push(`routing: expected ${expectedRouting}, got ${params.actualRouting}`);
  }

  for (const blocked of params.query.mustNotRetrieve) {
    if (params.retrievedSlugs.slice(0, 4).some((s) => slugMatches(s, blocked))) {
      violations.push(`mustNotRetrieve violated: ${blocked}`);
    }
  }

  const precisionAt4 = computePrecisionAt4({
    retrievedSlugs: params.retrievedSlugs,
    relevantSlugs: params.query.relevantSlugs,
  });
  const recallAt10 = computeRecallAt10({
    retrievedSlugs: params.retrievedSlugs,
    relevantSlugs: params.query.relevantSlugs,
  });

  if (
    !params.corpusUnavailable &&
    params.query.relevantSlugs.length > 0 &&
    precisionAt4 < 0.5
  ) {
    violations.push(`low precision@4: ${precisionAt4.toFixed(2)}`);
  }

  const entities = params.query.relevantEntities ?? [];
  for (const entity of entities) {
    const minGrade = entity.minGrade ?? 2;
    if (minGrade >= 3 && params.query.relevantSlugs.length > 0) {
      const hit = params.retrievedSlugs
        .slice(0, 4)
        .some((s) => slugMatches(s, entity.entitySlug));
      if (!hit) {
        violations.push(`grade-3 entity missing in top-4: ${entity.entitySlug}`);
      }
    }
  }

  const routingScore = routingMatch ? 100 : 0;
  const precisionScore = Math.round(precisionAt4 * 100);
  const recallScore = Math.round(recallAt10 * 100);
  const mustNotScore =
    params.query.mustNotRetrieve.length === 0 ||
    !violations.some((v) => v.startsWith('mustNotRetrieve'))
      ? 100
      : 0;

  const score = Math.round(
    routingScore * 0.35 + precisionScore * 0.35 + recallScore * 0.2 + mustNotScore * 0.1,
  );

  return {
    dimension: 'retrieval',
    score,
    passed: violations.length === 0,
    weight: 0.2,
    violations,
    metrics: {
      precisionAt4,
      recallAt10,
      routingMatch,
      actualRouting: params.actualRouting,
      expectedRouting: String(expectedRouting),
    },
  };
}
