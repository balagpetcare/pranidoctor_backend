import { renderInlineRagCitation } from '../../knowledge-ingestion/citation/citation.service.js';
import { buildGroundingInstruction as buildFullGroundingInstruction } from '../grounding/grounding-engine.js';
import type { RetrievedChunk, RetrievalLocale, SourceCitation } from '../knowledge-retrieval.types.js';

export function extractInlineCitation(
  citationJson: unknown,
  fallbackSourceKey: string,
): string {
  if (
    citationJson &&
    typeof citationJson === 'object' &&
    'inline' in citationJson &&
    typeof (citationJson as { inline?: string }).inline === 'string'
  ) {
    return (citationJson as { inline: string }).inline;
  }
  return renderInlineRagCitation(fallbackSourceKey);
}

export function buildCitationBlock(
  chunks: RetrievedChunk[],
  locale: RetrievalLocale,
): string {
  if (chunks.length === 0) return '';

  const header =
    locale === 'bn'
      ? 'তথ্যসূত্র (শুধুমাত্র নিচের তথ্য ব্যবহার করুন):'
      : 'Sources (use ONLY the following):';

  const lines = chunks.map((chunk, i) => {
    const sourceLine =
      chunk.sources[0]?.citation ??
      chunk.sources[0]?.title ??
      chunk.inlineCitation;
    return `[${i + 1}] ${chunk.inlineCitation} ${chunk.title} — ${sourceLine}\n    "${chunk.inlineCitation} ${chunk.excerpt.slice(0, 220)}"`;
  });

  return [header, ...lines].join('\n');
}

export function buildSourceCitations(params: {
  sourceId?: string | null;
  sourceKey?: string | null;
  slug?: string;
  titleBn: string;
  titleEn: string;
  locale: RetrievalLocale;
}): SourceCitation[] {
  const title = params.locale === 'bn' ? params.titleBn : params.titleEn;
  if (params.sourceId) {
    const citation = params.sourceKey ? `[${params.sourceKey}] ${title}` : title;
    return [
      {
        sourceId: params.sourceId,
        ...(params.sourceKey ? { sourceKey: params.sourceKey } : {}),
        title,
        citation,
      },
    ];
  }
  const key = params.sourceKey ?? params.slug;
  if (key) {
    return [
      {
        sourceId: key,
        sourceKey: key,
        title,
        citation: `[${key}] ${title}`,
      },
    ];
  }
  return [];
}

export function buildGroundingInstruction(locale: RetrievalLocale, citationBlock: string): string {
  return buildFullGroundingInstruction({
    locale,
    citationBlock,
    evidenceBlock: '',
    confidenceBlock: '',
    structuredFactsJson: '',
    strictness: 'light',
    taskType: 'GENERAL_CHAT',
  });
}
