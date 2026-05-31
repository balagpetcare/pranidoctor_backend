import type {
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeContentType,
  AiKnowledgeEvidenceLevel,
  LivestockSpecies,
} from '../../../generated/prisma/index.js';
import type { AiDbTaskType } from '../routing/ai-task.types.js';
import type { RetrievalMetadataJson } from './telemetry/retrieval-metadata.builder.js';

export type RetrievalLocale = 'bn' | 'en';

export type RetrievalMode = 'lexical' | 'hybrid' | 'semantic';

export type ConfidenceRoutingAction = 'PROCEED' | 'PROCEED_DEGRADED' | 'BLOCK' | 'ESCALATE_HUMAN';

export type MedicalRiskTier = 'NONE' | 'LOW' | 'HIGH' | 'CRITICAL';

export type DisclaimerLevel = 'standard' | 'elevated' | 'blocking';

export type SourceCitation = {
  sourceId: string;
  sourceKey?: string;
  title: string;
  citation: string;
};

export type StructuredFact = {
  factId: string;
  domain: string;
  factType: string;
  species?: LivestockSpecies;
  value: number | string | boolean;
  unit?: string;
  evidenceLevel: string;
  confidenceScore: number;
  sourceCitation: string;
};

export type RetrievedChunk = {
  knowledgeEntryId: string;
  chunkIndex: number;
  entryVersion: number;
  contentType: AiKnowledgeContentType;
  slug: string;
  title: string;
  excerpt: string;
  excerptEn?: string;
  headingPath?: string;
  evidenceLevel: AiKnowledgeEvidenceLevel;
  confidenceScore: number;
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
  rank: number;
  fusedScore: number;
  lexicalScore?: number;
  semanticScore?: number;
  inlineCitation: string;
  sources: SourceCitation[];
};

export type RetrievedEntity = {
  entityId: string;
  slug: string;
  contentType: AiKnowledgeContentType;
  title: string;
  evidenceLevel: AiKnowledgeEvidenceLevel;
  confidenceScore: number;
  rank: number;
  chunkCount: number;
  sources: SourceCitation[];
};

export type RetrievalFilters = {
  species?: LivestockSpecies;
  domainPriority: AiKnowledgeContentType[];
  minConfidence: number;
  minEvidenceLevel: AiKnowledgeEvidenceLevel;
  regionScope: string;
  status: 'PUBLISHED';
  vetApprovedRequired?: boolean;
};

export type EvidenceSummary = {
  min: string;
  max: string;
  dominant: string;
};

export type ConfidenceRoutingDecision = {
  action: ConfidenceRoutingAction;
  reason: string;
  failClosed: boolean;
  disclaimerLevel: DisclaimerLevel;
  medicalRiskTier: MedicalRiskTier;
};

export type KnowledgeContextPack = {
  packId: string;
  taskType: AiDbTaskType;
  locale: RetrievalLocale;
  query: string;
  normalizedQuery: string;
  retrievedAt: string;
  retrievalProfileId: string;
  retrievalMode: RetrievalMode;
  chunks: RetrievedChunk[];
  entities: RetrievedEntity[];
  structuredFacts: StructuredFact[];
  citationBlock: string;
  evidenceBlock: string;
  confidenceBlock: string;
  groundingInstruction: string;
  graphHints: Array<{ edgeType: string; fromSlug: string; toSlug: string; label: string }>;
  filtersApplied: RetrievalFilters;
  confidenceSummary: { min: number; max: number; avg: number };
  evidenceSummary: EvidenceSummary;
  excludedCount: number;
  embeddingCoverage: number;
  routingDecision: ConfidenceRoutingDecision;
  scores: {
    lexicalMs: number;
    semanticMs: number;
    fusionMs: number;
    rerankMs: number;
    crossEncoderMs?: number;
    rankMs: number;
    packBuildMs: number;
    totalMs: number;
  };
  retrievalMetadata?: RetrievalMetadataJson;
};

export type RetrievalProfile = {
  profileId: string;
  taskType: AiDbTaskType;
  domainPriority: AiKnowledgeContentType[];
  maxChunks: number;
  maxEntities: number;
  maxChunksPerEntity: number;
  minConfidence: number;
  minEvidenceLevel: AiKnowledgeEvidenceLevel;
  semanticEnabled: boolean;
  lexicalWeight: number;
  semanticWeight: number;
  minSemanticSimilarity: number;
  tokenBudget: number;
  failClosed: boolean;
  blockLowConfidenceMedical: boolean;
  medicalMinConfidence: number;
  vetApprovedRequired: boolean;
  localePreference: RetrievalLocale[];
  rerankerEnabled: boolean;
  groundingStrictness: 'strict' | 'moderate' | 'light';
};

export type RetrievalRequest = {
  query: string;
  locale: RetrievalLocale;
  taskType: AiDbTaskType;
  feature?: string;
  species?: LivestockSpecies;
  profileId?: string;
};

export type SearchCandidate = {
  knowledgeEntryId: string;
  chunkIndex: number;
  entryVersion: number;
  lexicalScore: number;
  semanticScore: number;
};

export const MEDICAL_CONTENT_TYPES: readonly AiKnowledgeContentType[] = [
  'MEDICINE',
  'EMERGENCY',
  'DISEASE',
  'VACCINE',
];

export const EVIDENCE_ORDER: AiKnowledgeEvidenceLevel[] = ['L1', 'L2', 'L3', 'L4', 'L5'];
