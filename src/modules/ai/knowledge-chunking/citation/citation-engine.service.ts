import {
  renderHumanCitation,
  renderInlineRagCitation,
} from '../../knowledge-ingestion/citation/citation.service.js';
import type { CitationSourceContext } from '../../knowledge-ingestion/citation/attribution.util.js';
import type { StagedChunkDraft, SourceSpanRef } from '../knowledge-chunking.types.js';

export type ChunkCitationDraft = {
  chunkIndex: number;
  sourceId: string;
  sourceKey: string;
  sourceTrustTier: number;
  documentId?: string;
  pageRef?: string;
  sectionRef?: string;
  tableRef?: string;
  rowRef?: string;
  spanRefsJson?: SourceSpanRef[];
  contributionWeight: number;
  inlineCitationKey: string;
  humanCitationBn: string;
  humanCitationEn: string;
};

export class CitationEngineService {
  readonly name = 'CitationEngineService';

  attachChunkCitations(params: {
    chunks: StagedChunkDraft[];
    versionCitations: Array<{
      sourceId: string;
      documentId: string | null;
      pageRef: string | null;
      sectionRef: string | null;
      tableRef: string | null;
      rowRef: string | null;
      spanRefsJson: unknown;
      contributionWeight: number;
      inlineCitationKey: string;
      source: CitationSourceContext;
      sourceTrustTier: number;
    }>;
  }): ChunkCitationDraft[] {
    if (params.versionCitations.length === 0) return [];

    const primary = params.versionCitations[0]!;
    const ctx = primary.source;
    const spanRefs = parseSpanRefs(primary.spanRefsJson);

    return params.chunks.map((chunk) => {
      const locator = resolveChunkLocator(chunk, primary, spanRefs);
      const inlineKey =
        primary.inlineCitationKey ||
        renderInlineRagCitation(primary.source.sourceKey, locator.pageRef);

      return {
        chunkIndex: chunk.chunkIndex,
        sourceId: primary.sourceId,
        sourceKey: primary.source.sourceKey,
        sourceTrustTier: primary.sourceTrustTier,
        ...(primary.documentId ? { documentId: primary.documentId } : {}),
        ...(locator.pageRef ? { pageRef: locator.pageRef } : {}),
        ...(locator.sectionRef ? { sectionRef: locator.sectionRef } : {}),
        ...(primary.tableRef ? { tableRef: primary.tableRef } : {}),
        ...(primary.rowRef ? { rowRef: primary.rowRef } : {}),
        ...(locator.spanRefs.length > 0 ? { spanRefsJson: locator.spanRefs } : {}),
        contributionWeight: primary.contributionWeight,
        inlineCitationKey: inlineKey,
        humanCitationBn: renderHumanCitation(ctx, 'bn', {
          ...(locator.pageRef ? { pageRef: locator.pageRef } : {}),
          ...(locator.sectionRef ? { sectionRef: locator.sectionRef } : {}),
        }),
        humanCitationEn: renderHumanCitation(ctx, 'en', {
          ...(locator.pageRef ? { pageRef: locator.pageRef } : {}),
          ...(locator.sectionRef ? { sectionRef: locator.sectionRef } : {}),
        }),
      };
    });
  }
}

function parseSpanRefs(value: unknown): SourceSpanRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is SourceSpanRef => typeof v === 'object' && v !== null);
}

function resolveChunkLocator(
  chunk: StagedChunkDraft,
  citation: { pageRef: string | null; sectionRef: string | null },
  spanRefs: SourceSpanRef[],
): { pageRef?: string; sectionRef?: string; spanRefs: SourceSpanRef[] } {
  const chunkSpans = chunk.sourceSpanRefs ?? spanRefs;
  const pageRef = chunkSpans[0]?.page?.toString() ?? citation.pageRef ?? undefined;
  const sectionRef = chunk.headingPath ?? chunkSpans[0]?.sectionId ?? citation.sectionRef ?? undefined;
  return {
    ...(pageRef ? { pageRef } : {}),
    ...(sectionRef ? { sectionRef } : {}),
    spanRefs: chunkSpans,
  };
}

let service: CitationEngineService | null = null;

export function getCitationEngineService(): CitationEngineService {
  if (!service) service = new CitationEngineService();
  return service;
}

export function resetCitationEngineForTests(): void {
  service = null;
}
