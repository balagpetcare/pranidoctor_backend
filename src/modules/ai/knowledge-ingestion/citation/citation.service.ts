import type { SourceAttribution, SourceSpanRef } from '../knowledge-ingestion.types.js';
import type { CitationSourceContext } from './attribution.util.js';

export { hasRequiredSourceAttribution, parseSourceAttributions, toCitationSourceContext } from './attribution.util.js';
export type { CitationSourceContext } from './attribution.util.js';

export function renderHumanCitation(
  source: CitationSourceContext,
  locale: 'bn' | 'en',
  locator?: { pageRef?: string; sectionRef?: string },
): string {
  const template =
    locale === 'bn'
      ? source.attributionTemplateBn
      : source.attributionTemplateEn;

  const title = locale === 'bn' ? source.titleBn : source.titleEn;
  const publisher = source.publisher ? ` — ${source.publisher}` : '';
  const year = source.publishYear ? ` (${source.publishYear})` : '';
  const loc = [locator?.sectionRef, locator?.pageRef].filter(Boolean).join(', ');

  if (template?.trim()) {
    return template
      .replace('{title}', title)
      .replace('{publisher}', source.publisher ?? '')
      .replace('{year}', String(source.publishYear ?? ''))
      .replace('{locator}', loc);
  }

  const base = `${title}${publisher}${year}`;
  return loc ? `${base}, ${loc}` : base;
}

export function renderInlineRagCitation(sourceKey: string, pageRef?: string): string {
  return pageRef ? `[${sourceKey}|${pageRef}]` : `[${sourceKey}]`;
}

export function buildSourceAttribution(params: {
  sourceId: string;
  documentId?: string;
  importRunId?: string;
  pageRef?: string;
  sectionRef?: string;
  spanRefs?: SourceSpanRef[];
  contributionWeight?: number;
}): SourceAttribution {
  const attribution: SourceAttribution = {
    sourceId: params.sourceId,
    contributionWeight: params.contributionWeight ?? 1,
    quotedFrom: false,
    accessedAt: new Date().toISOString(),
  };
  if (params.documentId) attribution.documentId = params.documentId;
  if (params.importRunId) attribution.importRunId = params.importRunId;
  if (params.pageRef) attribution.pageRef = params.pageRef;
  if (params.sectionRef) attribution.sectionRef = params.sectionRef;
  if (params.spanRefs?.length) attribution.spanRefs = params.spanRefs;
  return attribution;
}

export function buildCitationBlock(
  items: Array<{ title: string; citation: string; evidenceLevel?: string }>,
  locale: 'bn' | 'en',
): string {
  if (items.length === 0) return '';
  const header = locale === 'bn' ? 'তথ্যসূত্র:' : 'Sources:';
  return [header, ...items.map((item, i) => `[${i + 1}] ${item.title} — ${item.citation}`)].join('\n');
}

export function citationJsonFromAttribution(
  attribution: SourceAttribution,
  inline: string,
): Record<string, unknown> {
  return {
    inline,
    sourceId: attribution.sourceId,
    documentId: attribution.documentId ?? null,
    pageRef: attribution.pageRef ?? null,
    sectionRef: attribution.sectionRef ?? null,
    spanRefs: attribution.spanRefs ?? [],
  };
}
