import type { GroundedDifferential } from '../../../ai-doctor/ai-doctor.types.js';
import type { KnowledgeContextPack } from '../../knowledge-retrieval.types.js';
import type { DimensionScore, GoldenEvalRecord } from '../golden-set.types.js';

function slugMatches(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.includes(y) || y.includes(x);
}

export function scoreVeterinary(params: {
  query: GoldenEvalRecord;
  pack: KnowledgeContextPack;
  differentials?: GroundedDifferential[];
  assistantOutput?: string;
  disclaimerPresent?: boolean;
}): DimensionScore {
  const violations: string[] = [];
  const answer = params.query.expectedAnswer;
  const output = (params.assistantOutput ?? '').toLowerCase();
  const queryText = params.query.query.toLowerCase();

  const mustIncludeBn = answer?.mustIncludeBn ?? [];
  for (const term of mustIncludeBn) {
    const inOutput = output.includes(term.toLowerCase());
    const inQuery = queryText.includes(term.toLowerCase());
    const inDiffs = (params.differentials ?? []).some(
      (d) =>
        d.titleBn.toLowerCase().includes(term.toLowerCase()) ||
        d.slug.toLowerCase().includes(term.toLowerCase()),
    );
    if (!inOutput && !inDiffs && !inQuery && params.pack.chunks.length > 0) {
      violations.push(`expected BN term not reflected: ${term}`);
    }
  }

  const mustIncludeEn = answer?.mustIncludeEn ?? [];
  for (const term of mustIncludeEn) {
    if (output && !output.includes(term.toLowerCase())) {
      const inDiffs = (params.differentials ?? []).some((d) =>
        d.titleEn.toLowerCase().includes(term.toLowerCase()),
      );
      if (!inDiffs) {
        violations.push(`expected EN term not reflected: ${term}`);
      }
    }
  }

  if (answer?.disclaimerRequired && params.disclaimerPresent === false && output.length > 0) {
    violations.push('disclaimer required but not present');
  }

  if (answer?.maxClinicalAssertiveness === 'SUGGESTIVE' && output) {
    if (/\b(confirmed diagnosis|definitely has|100% sure)\b/i.test(params.assistantOutput ?? '')) {
      violations.push('assertiveness exceeds SUGGESTIVE');
    }
  }

  if (params.query.relevantSlugs.length > 0 && (params.differentials?.length ?? 0) > 0) {
    const diffSlugs = params.differentials!.map((d) => d.slug);
    const matched = params.query.relevantSlugs.some((rel) =>
      diffSlugs.some((s) => slugMatches(s, rel)),
    );
    if (!matched && params.query.intent === 'medical') {
      violations.push('differentials do not cover expected disease slugs');
    }
  }

  const allCited =
    (params.differentials ?? []).length === 0 ||
    (params.differentials ?? []).every((d) => d.citations.length > 0);
  if (!allCited && (params.differentials?.length ?? 0) > 0) {
    violations.push('differential without citations');
  }

  const includeScore =
    mustIncludeBn.length + mustIncludeEn.length === 0
      ? 100
      : Math.round(
          ((mustIncludeBn.length +
            mustIncludeEn.length -
            violations.filter((v) => v.startsWith('expected')).length) /
            (mustIncludeBn.length + mustIncludeEn.length)) *
            100,
        );

  const diffScore =
    params.query.relevantSlugs.length === 0 || (params.differentials?.length ?? 0) === 0
      ? 100
      : params.query.relevantSlugs.some((rel) =>
            (params.differentials ?? []).some((d) => slugMatches(d.slug, rel)),
          )
        ? 100
        : 40;

  const citationScore = allCited ? 100 : 0;
  const score = Math.round(includeScore * 0.35 + diffScore * 0.4 + citationScore * 0.25);

  return {
    dimension: 'veterinary',
    score,
    passed: violations.length === 0,
    weight: 0.15,
    violations,
    metrics: {
      differentialCount: params.differentials?.length ?? 0,
      allDifferentialsCited: allCited,
      answerType: answer?.answerType ?? 'unspecified',
    },
  };
}
