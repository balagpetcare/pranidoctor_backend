import type { AiKnowledgeEvidenceLevel } from '../../../../generated/prisma/index.js';
import { EVIDENCE_ORDER } from '../knowledge-retrieval.types.js';
import type { RetrievedChunk, RetrievalLocale } from '../knowledge-retrieval.types.js';

const EVIDENCE_LABELS_BN: Record<AiKnowledgeEvidenceLevel, string> = {
  L1: 'বিশেষজ্ঞ ঐকমত্য',
  L2: 'মাঠ পর্যায়ে যাচাইকৃত',
  L3: 'নিয়ন্ত্রিত গবেষণা',
  L4: 'সিস্টেমেটিক রিভিউ',
  L5: 'নিয়ন্ত্রক প্রাথমিক নথি',
};

const EVIDENCE_LABELS_EN: Record<AiKnowledgeEvidenceLevel, string> = {
  L1: 'Expert consensus',
  L2: 'Field validated',
  L3: 'Controlled studies',
  L4: 'Systematic review',
  L5: 'Regulatory primary',
};

export type EvidenceSummary = {
  min: AiKnowledgeEvidenceLevel;
  max: AiKnowledgeEvidenceLevel;
  dominant: AiKnowledgeEvidenceLevel;
};

export function buildEvidenceSummary(chunks: RetrievedChunk[]): EvidenceSummary | null {
  if (chunks.length === 0) return null;

  const levels = chunks.map((c) => c.evidenceLevel);
  const sorted = [...levels].sort(
    (a, b) => EVIDENCE_ORDER.indexOf(a) - EVIDENCE_ORDER.indexOf(b),
  );
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;

  const counts = new Map<AiKnowledgeEvidenceLevel, number>();
  for (const level of levels) {
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  let dominant = min;
  let topCount = 0;
  for (const [level, count] of counts) {
    if (count > topCount) {
      dominant = level;
      topCount = count;
    }
  }

  return { min, max, dominant };
}

export function buildEvidenceBlock(chunks: RetrievedChunk[], locale: RetrievalLocale): string {
  if (chunks.length === 0) return '';

  const labels = locale === 'bn' ? EVIDENCE_LABELS_BN : EVIDENCE_LABELS_EN;
  const header =
    locale === 'bn'
      ? 'প্রমাণের স্তর (Evidence):'
      : 'Evidence levels:';

  const lines = chunks.map((chunk, i) => {
    const label = labels[chunk.evidenceLevel] ?? chunk.evidenceLevel;
    return `• [${i + 1}] ${chunk.evidenceLevel} — ${label}`;
  });

  const summary = buildEvidenceSummary(chunks);
  const footer =
    summary && locale === 'bn'
      ? `সর্বোচ্চ প্রমাণ: ${summary.max} | সর্বনিম্ন: ${summary.min} | প্রাধান্যসহ: ${summary.dominant}`
      : summary
        ? `Max: ${summary.max} | Min: ${summary.min} | Dominant: ${summary.dominant}`
        : '';

  return [header, ...lines, footer].filter(Boolean).join('\n');
}

export function evidenceLevelOrdinal(level: AiKnowledgeEvidenceLevel): number {
  return EVIDENCE_ORDER.indexOf(level);
}
