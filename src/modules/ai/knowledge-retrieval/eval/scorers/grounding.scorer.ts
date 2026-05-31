import type { KnowledgeContextPack } from '../../knowledge-retrieval.types.js';
import type { DimensionScore } from '../golden-set.types.js';
import type { GoldenEvalRecord } from '../golden-set.types.js';

export function scoreGrounding(params: {
  query: GoldenEvalRecord;
  pack: KnowledgeContextPack;
}): DimensionScore {
  const violations: string[] = [];
  const chunks = params.pack.chunks;
  const groundable = chunks.filter((c) => c.inlineCitation.trim().length > 0);
  const citationCoverage = chunks.length > 0 ? groundable.length / chunks.length : 0;
  const hasGroundingInstruction = params.pack.groundingInstruction.trim().length > 0;

  if (params.query.intent === 'medical' && chunks.length > 0 && citationCoverage < 1) {
    violations.push(`citation coverage ${(citationCoverage * 100).toFixed(0)}% < 100%`);
  }

  if (chunks.length > 0 && !hasGroundingInstruction) {
    violations.push('missing grounding instruction in pack');
  }

  const requiredFacts = params.query.requiredStructuredFacts ?? [];
  if (requiredFacts.length > 0) {
    for (const factKey of requiredFacts) {
      const hasFact = params.pack.structuredFacts.some((f) =>
        `${f.factType}:${f.domain}`.includes(factKey) ||
        factKey.includes(String(f.value)),
      );
      if (!hasFact) {
        violations.push(`missing structured fact: ${factKey}`);
      }
    }
  }

  if (
    params.query.expectedAnswer?.structuredFactsRequired &&
    params.query.intent === 'prescription' &&
    params.pack.structuredFacts.length === 0 &&
    params.pack.routingDecision.action === 'PROCEED'
  ) {
    violations.push('prescription PROCEED without structured facts');
  }

  const coverageScore = Math.round(citationCoverage * 100);
  const instructionScore = hasGroundingInstruction || chunks.length === 0 ? 100 : 0;
  const factsScore =
    requiredFacts.length === 0
      ? 100
      : Math.round(
          ((requiredFacts.length -
            violations.filter((v) => v.startsWith('missing structured fact')).length) /
            requiredFacts.length) *
            100,
        );

  const score = Math.round(coverageScore * 0.5 + instructionScore * 0.25 + factsScore * 0.25);

  return {
    dimension: 'grounding',
    score,
    passed: violations.length === 0,
    weight: 0.15,
    violations,
    metrics: {
      citationCoverage,
      groundableChunkCount: groundable.length,
      chunkCount: chunks.length,
      hasGroundingInstruction,
      structuredFactCount: params.pack.structuredFacts.length,
    },
  };
}
