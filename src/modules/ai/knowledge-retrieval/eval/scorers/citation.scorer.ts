import type { KnowledgeContextPack } from '../../knowledge-retrieval.types.js';
import type { DimensionScore, GoldenEvalRecord } from '../golden-set.types.js';

function slugMatches(retrieved: string, expected: string): boolean {
  const r = retrieved.toLowerCase();
  const e = expected.toLowerCase();
  return r.includes(e) || e.includes(r);
}

export function scoreCitation(params: {
  query: GoldenEvalRecord;
  pack: KnowledgeContextPack;
}): DimensionScore {
  const violations: string[] = [];
  const spec = params.query.expectedCitations;
  const top4 = params.pack.chunks.slice(0, 4);
  const retrievedSlugs = top4.map((c) => c.slug);

  const inlineCount = top4.filter((c) => c.inlineCitation.trim().length > 0).length;
  const minCount = spec?.minCount ?? (params.query.intent === 'medical' ? 1 : 0);

  if (minCount > 0 && inlineCount < minCount) {
    violations.push(`citation count ${inlineCount} < min ${minCount}`);
  }

  if (spec?.inlineCitationInPack && params.pack.citationBlock.trim().length === 0 && top4.length > 0) {
    violations.push('expected inline citation block in pack');
  }

  const entities = spec?.entities ?? [];
  for (const entity of entities) {
    const hit = retrievedSlugs.some((s) => slugMatches(s, entity.slug));
    if (!hit) {
      violations.push(`expected citation entity missing in top-4: ${entity.slug}`);
    }
  }

  const sourceKeys = spec?.sourceKeys ?? [];
  if (sourceKeys.length > 0) {
    const packSourceKeys = new Set<string>();
    for (const chunk of top4) {
      for (const src of chunk.sources) {
        if (src.sourceKey) packSourceKeys.add(src.sourceKey);
      }
    }
    const matchedKeys = sourceKeys.filter((k) => packSourceKeys.has(k));
    if (matchedKeys.length === 0 && top4.length > 0) {
      violations.push(`no expected sourceKeys in top-4: ${sourceKeys.join(', ')}`);
    }
  }

  const relevantHits =
    params.query.relevantSlugs.length === 0
      ? 1
      : params.query.relevantSlugs.filter((rel) =>
          retrievedSlugs.some((s) => slugMatches(s, rel)),
        ).length;
  const entityHitRate =
    params.query.relevantSlugs.length > 0
      ? relevantHits / params.query.relevantSlugs.length
      : entities.length > 0
        ? entities.filter((e) => retrievedSlugs.some((s) => slugMatches(s, e.slug))).length /
          entities.length
        : 1;

  const countScore =
    minCount === 0 ? 100 : Math.min(100, Math.round((inlineCount / minCount) * 100));
  const entityScore = Math.round(entityHitRate * 100);
  const blockScore = spec?.inlineCitationInPack
    ? params.pack.citationBlock.trim().length > 0 || top4.length === 0
      ? 100
      : 0
    : 100;

  const score = Math.round(countScore * 0.4 + entityScore * 0.4 + blockScore * 0.2);

  return {
    dimension: 'citation',
    score,
    passed: violations.length === 0,
    weight: 0.15,
    violations,
    metrics: {
      inlineCitationCount: inlineCount,
      minCountRequired: minCount,
      entityHitRate,
      citationBlockPresent: params.pack.citationBlock.trim().length > 0,
    },
  };
}
