import type { ChunkCitationDraft } from '../citation/citation-engine.service.js';
import type { ConfidenceAssignmentResult } from '../confidence/confidence-assignment.service.js';
import type { EvidenceAssignmentResult } from '../evidence/evidence-assignment.service.js';
import {
  CHUNK_METADATA_SCHEMA_VERSION,
  hashChunkContent,
  localeFlagsFromContent,
  type ChunkMetadataEnvelopeV1,
  type StagedChunkDraft,
} from '../knowledge-chunking.types.js';

export class ChunkMetadataEnricher {
  readonly name = 'ChunkMetadataEnricher';

  enrich(params: {
    chunk: StagedChunkDraft;
    entity: { id: string; slug: string; domain: string; entityType: string };
    version: {
      id: string;
      species: string[];
      audience: string;
      regionScope: string;
      clinicalRiskTier: string;
      importRunId: string | null;
    };
    evidence: EvidenceAssignmentResult;
    confidence: ConfidenceAssignmentResult;
    citation?: ChunkCitationDraft;
  }): ChunkMetadataEnvelopeV1 {
    const localeFlags = localeFlagsFromContent(params.chunk.contentBn, params.chunk.contentEn);
    const structuredOverlayKeys = params.chunk.structuredOverlay
      ? Object.keys(params.chunk.structuredOverlay)
      : undefined;

    const citationCache = {
      primaryInlineToken: params.citation?.inlineCitationKey ?? '[unknown]',
      humanCitationBn: params.citation?.humanCitationBn ?? '',
      humanCitationEn: params.citation?.humanCitationEn ?? '',
      sourceKeys: params.citation?.sourceKey ? [params.citation.sourceKey] : [],
      trustTierMin: params.citation?.sourceTrustTier ?? 4,
    };

    const pageRef = params.citation?.pageRef;
    const sectionRef = params.citation?.sectionRef;

    const envelope: ChunkMetadataEnvelopeV1 = {
      schemaVersion: CHUNK_METADATA_SCHEMA_VERSION,
      entityId: params.entity.id,
      versionId: params.version.id,
      chunkIndex: params.chunk.chunkIndex,
      slug: params.entity.slug,
      domain: params.entity.domain,
      entityType: params.entity.entityType,
      primaryLocale: localeFlags.includes('BN_COMPLETE') ? 'bn' : 'en',
      localeFlags,
      species: params.version.species,
      audience: params.version.audience,
      regionScope: params.version.regionScope,
      clinicalRiskTier: params.version.clinicalRiskTier,
      evidenceLevel: params.evidence.evidenceLevel,
      confidenceScore: params.confidence.score,
      provisional: params.confidence.provisional,
      chunkPolicyId: params.chunk.chunkPolicyId,
      contentHash: hashChunkContent(params.chunk.contentBn, params.chunk.contentEn),
      citationCache,
      sourceSpanSummary: {
        ...(pageRef ? { pageRange: pageRef } : {}),
        ...(sectionRef ? { sectionIds: [sectionRef] } : {}),
        ...(params.citation?.documentId ? { documentIds: [params.citation.documentId] } : {}),
      },
      embed: {
        textTemplateVersion: '1.0',
        prefixTags: [
          `domain=${params.entity.domain}`,
          `species=${params.version.species.join(',') || 'ALL'}`,
          `risk=${params.version.clinicalRiskTier}`,
          `evidence=${params.evidence.evidenceLevel}`,
        ],
        excludeFromEmbedding: !params.chunk.contentBn.trim() && !params.chunk.contentEn.trim(),
      },
      retrieval: {
        lexicalBoost: 1,
        semanticBoost: 1,
        ...(structuredOverlayKeys?.length ? { structuredFactKeys: structuredOverlayKeys } : {}),
      },
      computedAt: new Date().toISOString(),
    };

    if (params.chunk.headingPath) envelope.headingPath = params.chunk.headingPath;
    if (structuredOverlayKeys?.length) envelope.structuredOverlayKeys = structuredOverlayKeys;
    if (params.version.importRunId) envelope.importRunId = params.version.importRunId;

    return envelope;
  }

  buildEmbeddingText(envelope: ChunkMetadataEnvelopeV1, contentBn: string, contentEn: string): string {
    const tags = envelope.embed.prefixTags.join(' ');
    const heading = envelope.headingPath ? `${envelope.headingPath}\n---\n` : '';
    const cite = envelope.citationCache.primaryInlineToken;
    return `${tags}\n${heading}${contentBn}\n---\n${contentEn}\n[cite=${cite}]`.slice(0, 8192);
  }
}

let enricher: ChunkMetadataEnricher | null = null;

export function getChunkMetadataEnricher(): ChunkMetadataEnricher {
  if (!enricher) enricher = new ChunkMetadataEnricher();
  return enricher;
}

export function resetChunkMetadataEnricherForTests(): void {
  enricher = null;
}
