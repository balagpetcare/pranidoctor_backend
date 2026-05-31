import { createHash } from 'node:crypto';

export const KNOWLEDGE_CHUNKING_SCHEMA_VERSION = '6b3.0';
export const CHUNK_METADATA_SCHEMA_VERSION = '1.0';
export const CONFIDENCE_FORMULA_VERSION = 'v2';
export const PROVISIONAL_CONFIDENCE_CAP = 0.65;

export const CHUNK_POLICY_IDS = [
  'DISEASE_BY_HEADING',
  'MEDICINE_BY_SECTION',
  'PROTOCOL_BY_STEP',
  'EMERGENCY_BY_ACTION',
  'VACCINE_BY_SCHEDULE_ROW',
  'FEED_BY_NUTRIENT_BLOCK',
  'FARM_MGMT_BY_SECTION',
  'REGULATORY_BY_RECORD',
  'STRUCTURED_BY_KEY',
  'GENERIC_BY_PARAGRAPH',
] as const;

export type ChunkPolicyId = (typeof CHUNK_POLICY_IDS)[number];

export type SourceSpanRef = {
  documentId?: string;
  page?: number;
  pageEnd?: number;
  sectionId?: string;
  paragraphIndex?: number;
  tableId?: string;
  rowIndex?: number;
  columnMap?: Record<string, string>;
  charStart?: number;
  charEnd?: number;
  quoteHash?: string;
};

export type StagedChunkDraft = {
  chunkIndex: number;
  chunkPolicyId: ChunkPolicyId;
  contentBn: string;
  contentEn: string;
  tokenEstimate: number;
  headingPath?: string;
  structuredOverlay?: Record<string, unknown>;
  sourceSpanRefs?: SourceSpanRef[];
};

export type ChunkMetadataEnvelopeV1 = {
  schemaVersion: typeof CHUNK_METADATA_SCHEMA_VERSION;
  entityId: string;
  versionId: string;
  chunkIndex: number;
  slug: string;
  domain: string;
  entityType: string;
  primaryLocale: 'bn' | 'en';
  localeFlags: string[];
  species: string[];
  audience: string;
  regionScope: string;
  clinicalRiskTier: string;
  evidenceLevel: string;
  confidenceScore: number;
  provisional: boolean;
  chunkPolicyId: string;
  headingPath?: string;
  structuredOverlayKeys?: string[];
  contentHash: string;
  citationCache: {
    primaryInlineToken: string;
    humanCitationBn: string;
    humanCitationEn: string;
    sourceKeys: string[];
    trustTierMin: number;
  };
  sourceSpanSummary: {
    pageRange?: string;
    sectionIds?: string[];
    documentIds?: string[];
  };
  embed: {
    textTemplateVersion: '1.0';
    prefixTags: string[];
    excludeFromEmbedding: boolean;
  };
  retrieval: {
    lexicalBoost: number;
    semanticBoost: number;
    structuredFactKeys?: string[];
  };
  importRunId?: string;
  computedAt: string;
};

export type ProcessVersionInput = {
  versionId: string;
  chunkPolicyId?: string;
  assessorId?: string;
  finalizeEvidence?: boolean;
};

export type ProcessVersionResult = {
  versionId: string;
  chunkCount: number;
  evidenceLevel: string;
  confidenceScore: number;
  provisional: boolean;
};

export function hashChunkContent(contentBn: string, contentEn: string): string {
  return createHash('sha256').update(`${contentBn}\n---\n${contentEn}`).digest('hex');
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
}

export function localeFlagsFromContent(contentBn: string, contentEn: string): string[] {
  const flags: string[] = [];
  if (contentBn.trim()) flags.push('BN_COMPLETE');
  if (contentEn.trim()) flags.push('EN_COMPLETE');
  if (!contentBn.trim() && contentEn.trim()) flags.push('BN_PENDING');
  return flags;
}
