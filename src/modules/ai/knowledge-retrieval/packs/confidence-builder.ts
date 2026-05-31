import type { RetrievedChunk, RetrievalLocale } from '../knowledge-retrieval.types.js';

export type ConfidenceSummary = {
  min: number;
  max: number;
  avg: number;
};

export function buildConfidenceSummary(chunks: RetrievedChunk[]): ConfidenceSummary {
  if (chunks.length === 0) return { min: 0, max: 0, avg: 0 };

  const scores = chunks.map((c) => c.confidenceScore);
  return {
    min: Math.min(...scores),
    max: Math.max(...scores),
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  };
}

function confidenceBand(score: number, locale: RetrievalLocale): string {
  if (score >= 0.75) return locale === 'bn' ? 'উচ্চ' : 'High';
  if (score >= 0.55) return locale === 'bn' ? 'মাঝারি' : 'Moderate';
  return locale === 'bn' ? 'নিম্ন' : 'Low';
}

export function buildConfidenceBlock(
  chunks: RetrievedChunk[],
  locale: RetrievalLocale,
  summary?: ConfidenceSummary,
): string {
  if (chunks.length === 0) return '';

  const resolved = summary ?? buildConfidenceSummary(chunks);
  const header =
    locale === 'bn'
      ? 'আস্থার স্কোর (Confidence 0–1):'
      : 'Confidence scores (0–1):';

  const lines = chunks.map((chunk, i) => {
    const band = confidenceBand(chunk.confidenceScore, locale);
    return `• [${i + 1}] ${chunk.confidenceScore.toFixed(2)} — ${band}`;
  });

  const footer =
    locale === 'bn'
      ? `গড়: ${resolved.avg.toFixed(2)} | সর্বনিম্ন: ${resolved.min.toFixed(2)}\nনিম্ন আস্থার তথ্য (< 0.55) clinical সিদ্ধান্তে ব্যবহার করবেন না।`
      : `Avg: ${resolved.avg.toFixed(2)} | Min: ${resolved.min.toFixed(2)}\nDo not use facts below 0.55 confidence for clinical decisions.`;

  return [header, ...lines, footer].join('\n');
}

export function isLowConfidenceSummary(summary: ConfidenceSummary, threshold: number): boolean {
  return summary.avg < threshold || summary.min < threshold * 0.85;
}
