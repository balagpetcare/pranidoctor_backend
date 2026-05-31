export type GoldenQuery = {
  id: string;
  tier: 'G0' | 'G1' | 'G2';
  locale: 'bn' | 'en';
  query: string;
  profileId: string;
  taskType: string;
  intent: string;
  colloquial: boolean;
  expectedRouting: string;
  relevantSlugs: string[];
  mustNotRetrieve: string[];
};

export type GoldenEvalResult = {
  queryId: string;
  passed: boolean;
  routingMatch: boolean;
  actualRouting: string;
  precisionAt4: number;
  violations: string[];
};

export function computePrecisionAt4(params: {
  retrievedSlugs: string[];
  relevantSlugs: string[];
}): number {
  if (params.relevantSlugs.length === 0) return 1;
  const top4 = params.retrievedSlugs.slice(0, 4);
  const hits = top4.filter((slug) =>
    params.relevantSlugs.some((rel) => slug.includes(rel) || rel.includes(slug)),
  ).length;
  return hits / 4;
}

export function evaluateGoldenQuery(params: {
  query: GoldenQuery;
  retrievedSlugs: string[];
  actualRouting: string;
}): GoldenEvalResult {
  const violations: string[] = [];
  const routingMatch =
    params.actualRouting === params.query.expectedRouting ||
    (params.query.expectedRouting === 'PROCEED' &&
      params.actualRouting === 'PROCEED_DEGRADED' &&
      params.retrievedSlugs.length === 0);
  if (!routingMatch) {
    violations.push(
      `routing: expected ${params.query.expectedRouting}, got ${params.actualRouting}`,
    );
  }

  for (const blocked of params.query.mustNotRetrieve) {
    if (params.retrievedSlugs.slice(0, 4).some((s) => s.includes(blocked))) {
      violations.push(`mustNotRetrieve violated: ${blocked}`);
    }
  }

  const precisionAt4 = computePrecisionAt4({
    retrievedSlugs: params.retrievedSlugs,
    relevantSlugs: params.query.relevantSlugs,
  });

  if (params.query.relevantSlugs.length > 0 && precisionAt4 < 0.5) {
    violations.push(`low precision@4: ${precisionAt4.toFixed(2)}`);
  }

  return {
    queryId: params.query.id,
    passed: violations.length === 0,
    routingMatch,
    actualRouting: params.actualRouting,
    precisionAt4,
    violations,
  };
}

export function summarizeGoldenEval(results: GoldenEvalResult[]): {
  total: number;
  passed: number;
  passRate: number;
  avgPrecisionAt4: number;
} {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const avgPrecisionAt4 =
    total > 0 ? results.reduce((sum, r) => sum + r.precisionAt4, 0) / total : 0;
  return {
    total,
    passed,
    passRate: total > 0 ? passed / total : 0,
    avgPrecisionAt4,
  };
}
