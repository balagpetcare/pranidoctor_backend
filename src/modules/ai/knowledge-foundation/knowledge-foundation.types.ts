import type {
  AiKnowledgeAudience,
  AiKnowledgeCatalogSourceType,
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeReviewDecision,
  AiKnowledgeSourceClass,
  AiKnowledgeSourceStatus,
  LivestockSpecies,
  VkKnowledgeDomain,
  VkReviewStage,
  VkVersionStatus,
} from '../../../generated/prisma/index.js';

export const KNOWLEDGE_FOUNDATION_SCHEMA_VERSION = '6b1.0';

export const VK_AUDIT_EVENTS = [
  'ENTITY_CREATED',
  'VERSION_FORKED',
  'VERSION_SUBMITTED',
  'REVIEW_OPENED',
  'REVIEW_COMPLETED',
  'APPROVAL_RECORDED',
  'VERSION_PUBLISHED',
  'VERSION_DEPRECATED',
  'CITATION_ADDED',
  'CITATION_REMOVED',
  'SOURCE_CREATED',
  'SOURCE_UPDATED',
  'EMERGENCY_UNPUBLISH',
  'GOVERNANCE_STAGE_CHANGED',
  'CHANGE_REQUEST_OPENED',
  'CHANGE_REQUEST_RESOLVED',
  'VERSION_RESUBMITTED',
  'CONFLICT_OPENED',
  'CONFLICT_RESOLVED',
  'GOVERNANCE_APPROVAL_READY',
  'VERSION_ARCHIVED',
  'GOVERNANCE_OVERRIDE',
  'APPROVAL_EXPIRED',
  'REREVIEW_TRIGGERED',
  'SLA_BREACH_ESCALATED',
] as const;

export type VkAuditEventType = (typeof VK_AUDIT_EVENTS)[number];

export type KnowledgeSourceDto = {
  id: string;
  sourceKey: string;
  sourceClass: AiKnowledgeSourceClass;
  sourceType: AiKnowledgeCatalogSourceType;
  titleBn: string;
  titleEn: string;
  publisher: string | null;
  publishYear: number | null;
  edition: string | null;
  jurisdiction: string;
  trustTier: number;
  status: AiKnowledgeSourceStatus;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeEntityDto = {
  id: string;
  domain: VkKnowledgeDomain;
  entityType: string;
  slug: string;
  currentPublishedVersionId: string | null;
  currentDraftVersionId: string | null;
  legacyEntryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeVersionDto = {
  id: string;
  entityId: string;
  versionNumber: number;
  supersedesVersionId: string | null;
  status: VkVersionStatus;
  titleBn: string;
  titleEn: string;
  summaryBn: string | null;
  summaryEn: string | null;
  bodyBn: string;
  bodyEn: string;
  species: LivestockSpecies[];
  audience: AiKnowledgeAudience;
  regionScope: string;
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
  chunkPolicyId: string | null;
  aiGeneratedDraft: boolean;
  publishedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  citationCount?: number;
};

export type KnowledgeCitationDto = {
  id: string;
  versionId: string;
  sourceId: string;
  documentId: string | null;
  pageRef: string | null;
  sectionRef: string | null;
  tableRef: string | null;
  rowRef: string | null;
  contributionWeight: number;
  quotedFrom: boolean;
  inlineCitationKey: string;
  humanCitationBn: string | null;
  humanCitationEn: string | null;
  accessedAt: string;
};

export type KnowledgeReviewDto = {
  id: string;
  versionId: string;
  stage: VkReviewStage;
  decision: AiKnowledgeReviewDecision | null;
  reviewerId: string | null;
  comments: string | null;
  queueSource: string;
  startedAt: string;
  completedAt: string | null;
};

export type KnowledgeApprovalDto = {
  id: string;
  versionId: string;
  approverVetId: string;
  vetLicenseNo: string | null;
  approvalScope: string[];
  signOffHash: string | null;
  approvedAt: string;
  validUntil: string | null;
  dualApprovalRequired: boolean;
  notes: string | null;
};

export type KnowledgeAuditEventDto = {
  id: string;
  entityId: string | null;
  versionId: string | null;
  eventType: VkAuditEventType;
  actorId: string | null;
  actorRole: string | null;
  detailJson: Record<string, unknown> | null;
  createdAt: string;
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
  allowedDomains?: VkKnowledgeDomain[];
  licenseId?: string;
};

export type CreateKnowledgeEntityInput = {
  domain: VkKnowledgeDomain;
  entityType: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  summaryBn?: string;
  summaryEn?: string;
  species?: LivestockSpecies[];
  audience?: AiKnowledgeAudience;
  regionScope?: string;
  clinicalRiskTier?: AiKnowledgeClinicalRiskTier;
  createdById?: string;
  legacyEntryId?: string;
};

export type UpdateKnowledgeVersionDraftInput = {
  titleBn?: string;
  titleEn?: string;
  summaryBn?: string;
  summaryEn?: string;
  bodyBn?: string;
  bodyEn?: string;
  species?: LivestockSpecies[];
  audience?: AiKnowledgeAudience;
  regionScope?: string;
  structuredJson?: Record<string, unknown>;
  keywordsBn?: string[];
  keywordsEn?: string[];
  colloquialBn?: string[];
  clinicalRiskTier?: AiKnowledgeClinicalRiskTier;
  changeSummary?: string;
};

export type AddKnowledgeCitationInput = {
  sourceId: string;
  documentId?: string;
  pageRef?: string;
  sectionRef?: string;
  tableRef?: string;
  rowRef?: string;
  contributionWeight?: number;
  quotedFrom?: boolean;
  inlineCitationKey?: string;
  humanCitationBn?: string;
  humanCitationEn?: string;
};

export type CompleteKnowledgeReviewInput = {
  reviewId: string;
  decision: AiKnowledgeReviewDecision;
  reviewerId: string;
  comments?: string;
  checklistJson?: Record<string, unknown>;
};

export type RecordKnowledgeApprovalInput = {
  versionId: string;
  approverVetId: string;
  vetLicenseNo: string;
  approvalScope: string[];
  validUntil?: Date;
  dualApprovalRequired?: boolean;
  coApproverVetId?: string;
  notes?: string;
};

export type FoundationActor = {
  id: string;
  role: string;
};

export function contentTypeToDomain(
  contentType: string,
): VkKnowledgeDomain {
  const map: Record<string, VkKnowledgeDomain> = {
    DISEASE: 'DISEASE',
    MEDICINE: 'MEDICINE',
    VACCINE: 'VACCINE',
    FEED: 'FEED',
    FARM_MGMT: 'FARM_MGMT',
    EMERGENCY: 'EMERGENCY',
  };
  return map[contentType] ?? 'FARM_MGMT';
}

export function buildSearchText(params: {
  titleBn: string;
  titleEn: string;
  summaryBn?: string | null;
  summaryEn?: string | null;
  bodyBn: string;
  bodyEn: string;
  keywordsBn?: string[];
  keywordsEn?: string[];
  colloquialBn?: string[];
}): string {
  return [
    params.titleBn,
    params.titleEn,
    params.summaryBn,
    params.summaryEn,
    params.bodyBn.slice(0, 2000),
    params.bodyEn.slice(0, 2000),
    ...(params.keywordsBn ?? []),
    ...(params.keywordsEn ?? []),
    ...(params.colloquialBn ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isVersionEditable(status: VkVersionStatus): boolean {
  return status === 'DRAFT' || status === 'CHANGES_REQUESTED';
}

export function requiresVetApproval(clinicalRiskTier: AiKnowledgeClinicalRiskTier): boolean {
  return clinicalRiskTier === 'HIGH' || clinicalRiskTier === 'CRITICAL';
}
