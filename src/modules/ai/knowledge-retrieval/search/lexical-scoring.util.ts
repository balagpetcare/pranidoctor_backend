/**
 * Locale-aware lexical scoring for BN-first bilingual retrieval.
 */
export function scoreTextMatch(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 0;
  if (lower === q) return 1;
  if (lower.includes(q)) {
    return Math.min(1, 0.5 + q.length / Math.max(lower.length, 1));
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const matched = tokens.filter((t) => lower.includes(t)).length;
  return (matched / tokens.length) * 0.85;
}

export function scoreLexicalMatch(params: {
  query: string;
  contentBn: string;
  contentEn: string;
  titleBn: string;
  titleEn: string;
  searchText?: string | null;
  locale?: 'bn' | 'en';
}): number {
  const bnScore = scoreTextMatch(params.contentBn, params.query);
  const enScore = scoreTextMatch(params.contentEn, params.query);
  const titleScore = Math.max(
    scoreTextMatch(params.titleBn, params.query),
    scoreTextMatch(params.titleEn, params.query),
    scoreTextMatch(params.searchText ?? '', params.query),
  );

  let lexicalScore = Math.max(bnScore, enScore, titleScore * 0.9);

  if (params.locale === 'bn' && bnScore >= enScore && bnScore > 0) {
    lexicalScore = Math.min(1, lexicalScore * 1.12);
  } else if (params.locale === 'en' && enScore > bnScore && enScore > 0) {
    lexicalScore = Math.min(1, lexicalScore * 1.12);
  }

  return lexicalScore;
}

export function resolveStructuredRecord(metadataJson: unknown): Record<string, unknown> | null {
  if (!metadataJson || typeof metadataJson !== 'object') return null;
  const root = metadataJson as Record<string, unknown>;
  const nested = root.structuredJson;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return null;
}
