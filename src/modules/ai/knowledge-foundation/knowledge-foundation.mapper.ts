import type {
  AiKnowledgeSource,
  VkKnowledgeApproval,
  VkKnowledgeAuditEvent,
  VkKnowledgeCitation,
  VkKnowledgeEntity,
  VkKnowledgeReview,
  VkKnowledgeVersion,
} from '../../../generated/prisma/index.js';
import type {
  KnowledgeApprovalDto,
  KnowledgeAuditEventDto,
  KnowledgeCitationDto,
  KnowledgeEntityDto,
  KnowledgeReviewDto,
  KnowledgeSourceDto,
  KnowledgeVersionDto,
  VkAuditEventType,
} from './knowledge-foundation.types.js';

export function toKnowledgeSourceDto(row: AiKnowledgeSource): KnowledgeSourceDto {
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    sourceClass: row.sourceClass,
    sourceType: row.sourceType,
    titleBn: row.titleBn,
    titleEn: row.titleEn,
    publisher: row.publisher,
    publishYear: row.publishYear,
    edition: row.edition,
    jurisdiction: row.jurisdiction,
    trustTier: row.trustTier,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toKnowledgeEntityDto(row: VkKnowledgeEntity): KnowledgeEntityDto {
  return {
    id: row.id,
    domain: row.domain,
    entityType: row.entityType,
    slug: row.slug,
    currentPublishedVersionId: row.currentPublishedVersionId,
    currentDraftVersionId: row.currentDraftVersionId,
    legacyEntryId: row.legacyEntryId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toKnowledgeVersionDto(
  row: VkKnowledgeVersion & { _count?: { citations: number } },
): KnowledgeVersionDto {
  return {
    id: row.id,
    entityId: row.entityId,
    versionNumber: row.versionNumber,
    supersedesVersionId: row.supersedesVersionId,
    status: row.status,
    titleBn: row.titleBn,
    titleEn: row.titleEn,
    summaryBn: row.summaryBn,
    summaryEn: row.summaryEn,
    bodyBn: row.bodyBn,
    bodyEn: row.bodyEn,
    species: row.species,
    audience: row.audience,
    regionScope: row.regionScope,
    clinicalRiskTier: row.clinicalRiskTier,
    chunkPolicyId: row.chunkPolicyId,
    aiGeneratedDraft: row.aiGeneratedDraft,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row._count ? { citationCount: row._count.citations } : {}),
  };
}

export function toKnowledgeCitationDto(row: VkKnowledgeCitation): KnowledgeCitationDto {
  return {
    id: row.id,
    versionId: row.versionId,
    sourceId: row.sourceId,
    documentId: row.documentId,
    pageRef: row.pageRef,
    sectionRef: row.sectionRef,
    tableRef: row.tableRef,
    rowRef: row.rowRef,
    contributionWeight: row.contributionWeight,
    quotedFrom: row.quotedFrom,
    inlineCitationKey: row.inlineCitationKey,
    humanCitationBn: row.humanCitationBn,
    humanCitationEn: row.humanCitationEn,
    accessedAt: row.accessedAt.toISOString(),
  };
}

export function toKnowledgeReviewDto(row: VkKnowledgeReview): KnowledgeReviewDto {
  return {
    id: row.id,
    versionId: row.versionId,
    stage: row.stage,
    decision: row.decision,
    reviewerId: row.reviewerId,
    comments: row.comments,
    queueSource: row.queueSource,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export function toKnowledgeApprovalDto(row: VkKnowledgeApproval): KnowledgeApprovalDto {
  return {
    id: row.id,
    versionId: row.versionId,
    approverVetId: row.approverVetId,
    vetLicenseNo: row.vetLicenseNo,
    approvalScope: row.approvalScope,
    signOffHash: row.signOffHash,
    approvedAt: row.approvedAt.toISOString(),
    validUntil: row.validUntil?.toISOString() ?? null,
    dualApprovalRequired: row.dualApprovalRequired,
    notes: row.notes,
  };
}

export function toKnowledgeAuditEventDto(row: VkKnowledgeAuditEvent): KnowledgeAuditEventDto {
  return {
    id: row.id,
    entityId: row.entityId,
    versionId: row.versionId,
    eventType: row.eventType as VkAuditEventType,
    actorId: row.actorId,
    actorRole: row.actorRole,
    detailJson: (row.detailJson as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function localeTitle(
  locale: 'bn' | 'en',
  version: Pick<VkKnowledgeVersion, 'titleBn' | 'titleEn'>,
): string {
  return locale === 'bn' ? version.titleBn : version.titleEn;
}

export function localeBody(
  locale: 'bn' | 'en',
  version: Pick<VkKnowledgeVersion, 'bodyBn' | 'bodyEn'>,
): string {
  return locale === 'bn' ? version.bodyBn : version.bodyEn;
}
