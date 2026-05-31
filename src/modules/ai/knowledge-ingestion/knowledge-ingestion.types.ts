import type {
  AiKnowledgeCatalogSourceType,
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeContentType,
  AiKnowledgeDocumentMediaType,
  AiKnowledgeEvidenceLevel,
  AiKnowledgeLicenseType,
  AiKnowledgeSourceClass,
  AiKnowledgeSourceStatus,
} from '../../../generated/prisma/index.js';

export const KNOWLEDGE_PIPELINE_VERSION = '1.0.0';

export const PROVISIONAL_CONFIDENCE_CAP = 0.65;

export type SourceSpanRef = {
  documentId?: string;
  page?: number;
  sectionId?: string;
  paragraphIndex?: number;
  tableId?: string;
  rowIndex?: number;
  charStart?: number;
  charEnd?: number;
  quoteHash?: string;
};

export type SourceAttribution = {
  sourceId: string;
  documentId?: string;
  pageRef?: string;
  sectionRef?: string;
  contributionWeight: number;
  quotedFrom: boolean;
  accessedAt: string;
  importRunId?: string;
  spanRefs?: SourceSpanRef[];
};

export type ImportRowInput = {
  slug: string;
  contentType: AiKnowledgeContentType;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  species?: string[];
  audience?: 'FARMER' | 'DOCTOR' | 'BOTH';
  clinicalRiskTier?: AiKnowledgeClinicalRiskTier;
  chunkPolicyId?: string;
  structuredJson?: Record<string, unknown>;
  sourceSpanRefs?: SourceSpanRef[];
};

export type ImportPipelineInput = {
  sourceId: string;
  documentId?: string;
  adapterId: string;
  triggeredById?: string;
  dryRun?: boolean;
  rows: ImportRowInput[];
};

export type ImportPipelineStats = {
  total: number;
  created: number;
  updated: number;
  merged: number;
  quarantined: number;
  skipped: number;
  quarantineErrors?: Array<{ rowSlug?: string; message: string }>;
};

export type CreateKnowledgeSourceInput = {
  sourceKey: string;
  sourceClass: AiKnowledgeSourceClass;
  sourceType: AiKnowledgeCatalogSourceType;
  titleBn: string;
  titleEn: string;
  publisher?: string;
  publishYear?: number;
  edition?: string;
  jurisdiction?: string;
  trustTier?: number;
  defaultEvidenceLevel?: AiKnowledgeEvidenceLevel;
  allowedDomains?: AiKnowledgeContentType[];
  licenseId?: string;
  refreshPolicyDays?: number;
  status?: AiKnowledgeSourceStatus;
};

export type CreateSourceLicenseInput = {
  licenseType: AiKnowledgeLicenseType;
  allowsAiExtraction?: boolean;
  allowsFarmerDistribution?: boolean;
  allowsVerbatimQuote?: boolean;
  expiryDate?: Date;
  attributionTemplateBn?: string;
  attributionTemplateEn?: string;
  rightsNote?: string;
};

export type CreateSourceDocumentInput = {
  sourceId: string;
  documentVersion: string;
  mediaType: AiKnowledgeDocumentMediaType;
  storageUri: string;
  checksumSha256: string;
  pageCount?: number;
  languagePrimary?: string;
  parseProfileId?: string;
  rightsNote?: string;
  supersedesDocumentId?: string;
};

export type ChunkPolicyId =
  | 'DISEASE_BY_HEADING'
  | 'MEDICINE_BY_SECTION'
  | 'PROTOCOL_BY_STEP'
  | 'SCHEDULE_BY_ROW'
  | 'FEED_BY_INGREDIENT'
  | 'BREED_BY_SECTION'
  | 'EMERGENCY_BY_ACTION'
  | 'REGULATORY_BY_RECORD'
  | 'GOVT_BY_SECTION'
  | 'GENERIC_BY_PARAGRAPH';

export type StagedChunk = {
  chunkIndex: number;
  chunkPolicyId: ChunkPolicyId;
  contentBn: string;
  contentEn: string;
  tokenEstimate: number;
  headingPath?: string;
  citationJson?: Record<string, unknown>;
};

export type EditorialReviewInput = {
  knowledgeEntryId: string;
  reviewerId: string;
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
  comments?: string;
  evidenceLevel?: AiKnowledgeEvidenceLevel;
  checklistJson?: Record<string, unknown>;
};

export type VetApprovalInput = {
  knowledgeEntryId: string;
  approverVetId: string;
  vetLicenseNo?: string;
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
  notes?: string;
  evidenceLevel?: AiKnowledgeEvidenceLevel;
  validUntilDays?: number;
};

export type PublishKnowledgeInput = {
  knowledgeEntryId: string;
  actorUserId?: string;
  reviewedById?: string;
};
