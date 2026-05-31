import type { SourceAttribution } from '../knowledge-ingestion.types.js';

export type CitationSourceContext = {
  sourceKey: string;
  titleBn: string;
  titleEn: string;
  publisher?: string | null;
  publishYear?: number | null;
  attributionTemplateBn?: string | null;
  attributionTemplateEn?: string | null;
};

export function toCitationSourceContext(source: {
  sourceKey: string;
  titleBn: string;
  titleEn: string;
  publisher?: string | null;
  publishYear?: number | null;
  license?: {
    attributionTemplateBn?: string | null;
    attributionTemplateEn?: string | null;
  } | null;
}): CitationSourceContext {
  return {
    sourceKey: source.sourceKey,
    titleBn: source.titleBn,
    titleEn: source.titleEn,
    ...(source.publisher !== undefined ? { publisher: source.publisher } : {}),
    ...(source.publishYear !== undefined ? { publishYear: source.publishYear } : {}),
    ...(source.license?.attributionTemplateBn !== undefined
      ? { attributionTemplateBn: source.license.attributionTemplateBn }
      : {}),
    ...(source.license?.attributionTemplateEn !== undefined
      ? { attributionTemplateEn: source.license.attributionTemplateEn }
      : {}),
  };
}

export function parseSourceAttributions(metadataJson: unknown): SourceAttribution[] {
  if (!metadataJson || typeof metadataJson !== 'object') return [];
  const attrs = (metadataJson as { sourceAttributions?: unknown }).sourceAttributions;
  if (!Array.isArray(attrs)) return [];
  return attrs.filter(
    (item): item is SourceAttribution =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as SourceAttribution).sourceId === 'string',
  );
}

export function hasRequiredSourceAttribution(metadataJson: unknown): boolean {
  return parseSourceAttributions(metadataJson).some((a) => a.sourceId.trim().length > 0);
}
