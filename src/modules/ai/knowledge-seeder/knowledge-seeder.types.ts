import type { VkKnowledgeDomain } from '../../../generated/prisma/index.js';
import type { ImportPipelineStats } from '../knowledge-import/knowledge-import.types.js';
import type { SeederAuditEventType } from './knowledge-seeder.constants.js';

export const SEEDER_DOMAINS = [
  'DISEASE',
  'MEDICINE',
  'VACCINE',
  'FEED',
  'BREED',
  'REPRODUCTION',
  'EMERGENCY',
  'CLINICAL_PROTOCOL',
] as const;

export type SeederDomain = (typeof SEEDER_DOMAINS)[number];

export type SeederBundleRow = {
  slug: string;
  domain: SeederDomain;
  entityType?: string;
  contentType?: string;
  titleBn: string;
  titleEn: string;
  summaryBn?: string;
  summaryEn?: string;
  bodyBn: string;
  bodyEn: string;
  species?: string[];
  audience?: 'FARMER' | 'DOCTOR' | 'BOTH';
  regionScope?: string;
  clinicalRiskTier?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  chunkPolicyId?: string;
  keywordsBn?: string[];
  keywordsEn?: string[];
  colloquialBn?: string[];
  structuredJson?: Record<string, unknown>;
  sourceSpanRefs?: Array<{
    page?: number;
    sectionId?: string;
    paragraphIndex?: number;
  }>;
};

export type SeederValidationIssue = {
  rowIndex: number;
  slug?: string;
  code: string;
  message: string;
  field?: string;
};

export type SeederValidationReport = {
  filePath: string;
  domain?: SeederDomain;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: SeederValidationIssue[];
  passed: boolean;
};

export type SeederImportInput = {
  sourceId: string;
  documentId?: string;
  filePath: string;
  domain?: SeederDomain;
  dryRun?: boolean;
  triggeredById?: string;
  actorId?: string;
  actorRole?: string;
};

export type SeederImportResult = {
  importRunId: string;
  stats: ImportPipelineStats;
  versionIds: string[];
  validation: SeederValidationReport;
};

export type SeederBatchManifestEntry = {
  filePath: string;
  sourceId: string;
  documentId?: string;
  domain?: SeederDomain;
};

export type SeederBatchManifest = {
  manifestVersion: string;
  description?: string;
  entries: SeederBatchManifestEntry[];
};

export type SeederBatchResult = {
  results: SeederImportResult[];
  totalEntries: number;
  succeeded: number;
  failed: number;
};

export type SeederApprovalSubmitInput = {
  importRunId?: string;
  versionIds?: string[];
  actorId: string;
  actorRole?: string;
};

export type SeederApprovalSubmitResult = {
  submitted: string[];
  skipped: Array<{ versionId: string; reason: string }>;
};

export type SeederApprovalStatusResult = {
  versionId: string;
  entitySlug: string;
  domain: VkKnowledgeDomain;
  governanceStage: string;
  versionStatus: string;
  clinicalRiskTier: string;
};

export type SeederAuditEntry = {
  eventType: SeederAuditEventType;
  at: string;
  actorId?: string;
  detail: Record<string, unknown>;
};

export type DomainTemplateDefinition = {
  domain: SeederDomain;
  schemaFile: string;
  csvHeaders: string[];
  defaultEntityType: string;
  defaultChunkPolicyId: string;
  defaultClinicalRiskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredFields: string[];
  requiredBnFields: string[];
  structuredJsonRequiredKeys?: string[];
};
