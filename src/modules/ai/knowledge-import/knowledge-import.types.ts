export const KNOWLEDGE_IMPORT_PIPELINE_VERSION = '6b2.0';

export const KIP_AUDIT_EVENTS = [
  'IMPORT_RUN_STARTED',
  'IMPORT_EXTRACT_COMPLETE',
  'IMPORT_VALIDATION_PASSED',
  'IMPORT_VALIDATION_FAILED',
  'IMPORT_VERSION_CREATED',
  'IMPORT_ROUTED_EDITORIAL',
  'IMPORT_ROUTED_VET',
  'IMPORT_QUARANTINED',
  'IMPORT_RUN_COMPLETED',
  'IMPORT_RUN_FAILED',
  'IMPORT_JOB_RETRY',
] as const;

export type KipAuditEventType = (typeof KIP_AUDIT_EVENTS)[number];

export type SourceFamilyKey =
  | 'VETERINARY_BOOK'
  | 'CLINICAL_GUIDELINE'
  | 'BPA_WPA_DOCUMENT'
  | 'GOVT_LIVESTOCK_MANUAL'
  | 'MEDICINE_REFERENCE'
  | 'VACCINE_REFERENCE'
  | 'FEED_REFERENCE';

export type ImportRunMode = 'LIVE' | 'DRY_RUN' | 'REIMPORT_DIFF';

export type RawExtract = {
  extractIndex: number;
  slug: string;
  contentType: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  species?: string[];
  audience?: 'FARMER' | 'DOCTOR' | 'BOTH';
  clinicalRiskTier?: string;
  structuredJson?: Record<string, unknown>;
  sourceSpanRefs?: Array<{
    page?: number;
    sectionId?: string;
    paragraphIndex?: number;
  }>;
  sectionHash?: string;
  /** VKF domain override (Phase 6E seeder bundles). */
  domain?: string;
  entityType?: string;
  summaryBn?: string;
  summaryEn?: string;
  keywordsBn?: string[];
  keywordsEn?: string[];
  colloquialBn?: string[];
  chunkPolicyId?: string;
  regionScope?: string;
};

export type NormalizedEntityDraft = {
  extractIndex: number;
  entityType: string;
  domain: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  species: string[];
  audience: 'FARMER' | 'DOCTOR' | 'BOTH';
  regionScope: string;
  clinicalRiskTier: string;
  structuredJson?: Record<string, unknown>;
  sourceSpanRefs?: RawExtract['sourceSpanRefs'];
  localeFlags: string[];
  provenanceJson: Record<string, unknown>;
  dedupKey: string;
  summaryBn?: string;
  summaryEn?: string;
  keywordsBn?: string[];
  keywordsEn?: string[];
  colloquialBn?: string[];
  chunkPolicyId?: string;
};

export type DedupDecision =
  | 'CREATE_NEW'
  | 'SUPERSEDE'
  | 'MERGE_FIELDS'
  | 'SKIP_DUPLICATE'
  | 'QUARANTINE_CONFLICT';

export type DedupResult = {
  decision: DedupDecision;
  existingEntityId?: string;
  existingSlug?: string;
  conflictFields?: string[];
};

export type ValidationFailure = {
  code: string;
  message: string;
};

export type ImportPipelineStats = {
  total: number;
  extracted: number;
  validated: number;
  normalized: number;
  versionsCreated: number;
  skipped: number;
  quarantined: number;
  routedEditorial: number;
  routedVet: number;
};

export type StartImportInput = {
  sourceId: string;
  documentId?: string;
  rows: Array<Record<string, unknown>>;
  triggeredById?: string;
  dryRun?: boolean;
  mode?: ImportRunMode;
  sync?: boolean;
};

export type ImportActor = {
  id: string;
  role: string;
};

export type SourceFamilyProfile = {
  profileKey: string;
  sourceFamily: SourceFamilyKey;
  sourceClasses: string[];
  adapterId: string;
  allowedMediaTypes: string[];
  allowedDomains: string[];
  defaultClinicalRiskTier: string;
  requiresVetByDefault: boolean;
  dedupKeyFields: string[];
};

export type ImportJobPayload = {
  importRunId: string;
  stage: string;
  data?: Record<string, unknown>;
};
