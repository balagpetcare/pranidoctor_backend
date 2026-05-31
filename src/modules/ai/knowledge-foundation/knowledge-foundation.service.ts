import {
  toKnowledgeApprovalDto,
  toKnowledgeCitationDto,
  toKnowledgeEntityDto,
  toKnowledgeSourceDto,
  toKnowledgeVersionDto,
} from './knowledge-foundation.mapper.js';
import {
  buildSearchText,
  isVersionEditable,
  requiresVetApproval,
  type AddKnowledgeCitationInput,
  type CompleteKnowledgeReviewInput,
  type CreateKnowledgeEntityInput,
  type CreateKnowledgeSourceInput,
  type FoundationActor,
  type KnowledgeCitationDto,
  type KnowledgeEntityDto,
  type KnowledgeSourceDto,
  type KnowledgeVersionDto,
  type RecordKnowledgeApprovalInput,
  type UpdateKnowledgeVersionDraftInput,
  type KnowledgeApprovalDto,
} from './knowledge-foundation.types.js';
import {
  KnowledgeWorkflowError,
  KnowledgeVersionImmutableError,
} from './knowledge-foundation.errors.js';
import {
  defaultInlineCitationKey,
  computeVersionSignOffHash,
  evaluateCitationTrustRules,
  filterVersionLevelSignOffCitations,
} from './knowledge-foundation.util.js';
import { getKnowledgeAuditService } from './audit/knowledge-audit.service.js';
import { getKnowledgeCitationRepository } from './repositories/knowledge-citation.repository.js';
import { getKnowledgeEntityRepository } from './repositories/knowledge-entity.repository.js';
import { getKnowledgeVersionRepository } from './repositories/knowledge-version.repository.js';
import { getKnowledgeReviewRepository } from './repositories/knowledge-review.repository.js';
import { getKnowledgeApprovalRepository } from './repositories/knowledge-approval.repository.js';
import { getKnowledgeSourceRepository } from './repositories/knowledge-source.repository.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import type { AiKnowledgeClinicalRiskTier } from '../../../generated/prisma/index.js';
import {
  buildSourceAttribution,
  renderHumanCitation,
  toCitationSourceContext,
} from '../knowledge-ingestion/citation/citation.service.js';
import { getKnowledgeChunkingOrchestratorService } from '../knowledge-chunking/index.js';
import { getKnowledgeChunkRepository } from '../knowledge-chunking/repositories/knowledge-chunk.repository.js';
import { getVkLegacyRagSyncService } from './vk-legacy-rag-sync.service.js';

export class KnowledgeFoundationService {
  readonly name = 'KnowledgeFoundationService';

  // ── Sources ─────────────────────────────────────────────────────────────

  async listSources(): Promise<KnowledgeSourceDto[]> {
    const rows = await getKnowledgeSourceRepository().list();
    return rows.map(toKnowledgeSourceDto);
  }

  async getSource(id: string): Promise<KnowledgeSourceDto> {
    const row = await getKnowledgeSourceRepository().require(id);
    return toKnowledgeSourceDto(row);
  }

  async createSource(
    input: CreateKnowledgeSourceInput,
    actor?: FoundationActor,
  ): Promise<KnowledgeSourceDto> {
    if (!input.titleBn?.trim()) {
      throw new KnowledgeWorkflowError('TITLE_BN_REQUIRED', 'Bangla title (titleBn) is required');
    }
    const row = await getKnowledgeSourceRepository().create(input);
    await getKnowledgeAuditService().record({
      eventType: 'SOURCE_CREATED',
      ...(actor ? { actor } : {}),
      detail: { sourceId: row.id, sourceKey: row.sourceKey },
    });
    return toKnowledgeSourceDto(row);
  }

  async updateSource(
    id: string,
    input: Partial<CreateKnowledgeSourceInput>,
    actor?: FoundationActor,
  ): Promise<KnowledgeSourceDto> {
    const row = await getKnowledgeSourceRepository().update(id, input);
    await getKnowledgeAuditService().record({
      eventType: 'SOURCE_UPDATED',
      ...(actor ? { actor } : {}),
      detail: { sourceId: row.id },
    });
    return toKnowledgeSourceDto(row);
  }

  // ── Entities & versions ─────────────────────────────────────────────────

  async listEntities(domain?: string): Promise<KnowledgeEntityDto[]> {
    const rows = await getKnowledgeEntityRepository().list(
      omitUndefined({ domain, limit: 100 }),
    );
    return rows.map(toKnowledgeEntityDto);
  }

  async getEntity(id: string): Promise<KnowledgeEntityDto & { versions: KnowledgeVersionDto[] }> {
    const entity = await getKnowledgeEntityRepository().requireEntity(id);
    const versions = await getKnowledgeVersionRepository().listByEntity(id);
    return {
      ...toKnowledgeEntityDto(entity),
      versions: versions.map((v) => toKnowledgeVersionDto(v)),
    };
  }

  async createEntity(
    input: CreateKnowledgeEntityInput,
    actor?: FoundationActor,
  ): Promise<{ entity: KnowledgeEntityDto; version: KnowledgeVersionDto }> {
    if (!input.titleBn?.trim() || !input.bodyBn?.trim()) {
      throw new KnowledgeWorkflowError(
        'BN_CONTENT_REQUIRED',
        'Bangla title and body are required (BN-first authoring)',
      );
    }
    if (!input.titleEn?.trim() || !input.bodyEn?.trim()) {
      throw new KnowledgeWorkflowError(
        'EN_CONTENT_REQUIRED',
        'English title and body are required for multi-language readiness',
      );
    }

    const existing = await getKnowledgeEntityRepository().findBySlug(input.slug);
    if (existing) {
      throw new KnowledgeWorkflowError('SLUG_EXISTS', `Entity slug already exists: ${input.slug}`);
    }

    const searchText = buildSearchText(input);
    const { entity, version } = await getKnowledgeEntityRepository().createWithInitialVersion(
      omitUndefined({
        ...input,
        createdById: actor?.id ?? input.createdById,
      }),
      searchText,
    );

    await getKnowledgeAuditService().record({
      eventType: 'ENTITY_CREATED',
      entityId: entity.id,
      versionId: version.id,
      ...(actor ? { actor } : {}),
      detail: { slug: entity.slug, domain: entity.domain },
    });

    return {
      entity: toKnowledgeEntityDto(entity),
      version: toKnowledgeVersionDto(version),
    };
  }

  async getVersion(id: string): Promise<KnowledgeVersionDto> {
    const row = await getKnowledgeVersionRepository().requireVersion(id);
    return toKnowledgeVersionDto(row);
  }

  async updateVersionDraft(
    versionId: string,
    input: UpdateKnowledgeVersionDraftInput,
    _actor?: FoundationActor,
  ): Promise<KnowledgeVersionDto> {
    const current = await getKnowledgeVersionRepository().requireVersion(versionId);
    if (!isVersionEditable(current.status)) {
      throw new KnowledgeVersionImmutableError(current.status);
    }

    const merged = {
      titleBn: input.titleBn ?? current.titleBn,
      titleEn: input.titleEn ?? current.titleEn,
      summaryBn: input.summaryBn ?? current.summaryBn,
      summaryEn: input.summaryEn ?? current.summaryEn,
      bodyBn: input.bodyBn ?? current.bodyBn,
      bodyEn: input.bodyEn ?? current.bodyEn,
      keywordsBn: input.keywordsBn ?? current.keywordsBn,
      keywordsEn: input.keywordsEn ?? current.keywordsEn,
      colloquialBn: input.colloquialBn ?? current.colloquialBn,
    };

    const row = await getKnowledgeVersionRepository().updateDraft(versionId, {
      ...input,
      searchText: buildSearchText(merged),
    });

    return toKnowledgeVersionDto(row);
  }

  async forkVersion(
    versionId: string,
    actor?: FoundationActor,
  ): Promise<KnowledgeVersionDto> {
    const from = await getKnowledgeVersionRepository().findPlainById(versionId);
    if (!from) {
      throw new KnowledgeWorkflowError('VERSION_NOT_FOUND', 'Version not found');
    }
    if (from.status !== 'PUBLISHED') {
      throw new KnowledgeWorkflowError('FORK_REQUIRES_PUBLISHED', 'Can only fork from published versions');
    }

    const entity = await getKnowledgeEntityRepository().requireEntity(from.entityId);
    if (entity.currentDraftVersionId) {
      throw new KnowledgeWorkflowError('DRAFT_EXISTS', 'Entity already has an active draft version');
    }

    const version = await getKnowledgeVersionRepository().forkDraft(
      omitUndefined({
        entityId: from.entityId,
        fromVersion: from,
        createdById: actor?.id,
      }),
    );

    await getKnowledgeAuditService().record({
      eventType: 'VERSION_FORKED',
      entityId: from.entityId,
      versionId: version.id,
      ...(actor ? { actor } : {}),
      detail: { fromVersionId: from.id, versionNumber: version.versionNumber },
    });

    return toKnowledgeVersionDto(version);
  }

  async submitVersionForReview(versionId: string, actor?: FoundationActor): Promise<KnowledgeVersionDto> {
    const version = await getKnowledgeVersionRepository().requireVersion(versionId);
    if (version.status !== 'DRAFT' && version.status !== 'CHANGES_REQUESTED') {
      throw new KnowledgeWorkflowError('INVALID_STATUS', `Cannot submit version in status ${version.status}`);
    }

    const citationCount = await getKnowledgeCitationRepository().countByVersion(versionId);
    if (citationCount < 1) {
      throw new KnowledgeWorkflowError('CITATION_REQUIRED', 'At least one source citation is required');
    }
    const citationsForTrust = await getKnowledgeCitationRepository().listByVersion(versionId);
    this.assertCitationTrust(version, citationsForTrust);
    if (!version.titleBn.trim() || !version.bodyBn.trim()) {
      throw new KnowledgeWorkflowError('BN_CONTENT_REQUIRED', 'Bangla content required before submit');
    }
    if (!version.titleEn.trim() || !version.bodyEn.trim()) {
      throw new KnowledgeWorkflowError('EN_CONTENT_REQUIRED', 'English content required before submit');
    }

    await getKnowledgeReviewRepository().openReview({
      versionId,
      stage: 'EDITORIAL',
      ...(actor?.id ? { reviewerId: actor.id } : {}),
      queueSource: 'MANUAL',
    });

    const updated = await getKnowledgeVersionRepository().updateStatus(versionId, 'IN_REVIEW', {
      submittedAt: new Date(),
    });

    await getKnowledgeAuditService().record({
      eventType: 'VERSION_SUBMITTED',
      entityId: version.entityId,
      versionId,
      ...(actor ? { actor } : {}),
    });

    await getKnowledgeAuditService().record({
      eventType: 'REVIEW_OPENED',
      entityId: version.entityId,
      versionId,
      ...(actor ? { actor } : {}),
      detail: { stage: 'EDITORIAL' },
    });

    return toKnowledgeVersionDto(updated);
  }

  // ── Citations ───────────────────────────────────────────────────────────

  private assertCitationTrust(
    version: { clinicalRiskTier: AiKnowledgeClinicalRiskTier },
    citations: Array<{ pageRef: string | null; sectionRef: string | null; source: { trustTier: number } }>,
  ): void {
    const result = evaluateCitationTrustRules({
      clinicalRiskTier: version.clinicalRiskTier,
      citations: citations.map((c) => ({
        pageRef: c.pageRef,
        sectionRef: c.sectionRef,
        sourceTrustTier: c.source.trustTier,
      })),
    });
    if (!result.ok) {
      throw new KnowledgeWorkflowError(result.code, result.message);
    }
  }

  async listCitations(versionId: string): Promise<KnowledgeCitationDto[]> {
    const rows = await getKnowledgeCitationRepository().listByVersion(versionId);
    return rows.map(toKnowledgeCitationDto);
  }

  async addCitation(
    versionId: string,
    input: AddKnowledgeCitationInput,
    actor?: FoundationActor,
  ): Promise<KnowledgeCitationDto> {
    const version = await getKnowledgeVersionRepository().requireVersion(versionId);
    if (!isVersionEditable(version.status)) {
      throw new KnowledgeVersionImmutableError(version.status);
    }

    const source = await getKnowledgeSourceRepository().require(input.sourceId);
    const inlineKey =
      input.inlineCitationKey ??
      defaultInlineCitationKey(source.sourceKey, input.pageRef);

    const humanBn =
      input.humanCitationBn ??
      renderHumanCitation(
        toCitationSourceContext(source),
        'bn',
        omitUndefined({ pageRef: input.pageRef, sectionRef: input.sectionRef }),
      );
    const humanEn =
      input.humanCitationEn ??
      renderHumanCitation(
        toCitationSourceContext(source),
        'en',
        omitUndefined({ pageRef: input.pageRef, sectionRef: input.sectionRef }),
      );

    buildSourceAttribution(
      omitUndefined({
        sourceId: input.sourceId,
        documentId: input.documentId,
        pageRef: input.pageRef,
        sectionRef: input.sectionRef,
        contributionWeight: input.contributionWeight,
      }),
    );

    const row = await getKnowledgeCitationRepository().create(versionId, {
      ...input,
      inlineCitationKey: inlineKey,
      humanCitationBn: humanBn,
      humanCitationEn: humanEn,
    });

    await getKnowledgeAuditService().record({
      eventType: 'CITATION_ADDED',
      entityId: version.entityId,
      versionId,
      ...(actor ? { actor } : {}),
      detail: { citationId: row.id, sourceId: input.sourceId },
    });

    return toKnowledgeCitationDto(row);
  }

  async removeCitation(citationId: string, actor?: FoundationActor): Promise<void> {
    const citation = await getKnowledgeCitationRepository().findById(citationId);
    if (!citation) {
      throw new KnowledgeWorkflowError('CITATION_NOT_FOUND', 'Citation not found');
    }
    const version = await getKnowledgeVersionRepository().requireVersion(citation.versionId);
    if (!isVersionEditable(version.status)) {
      throw new KnowledgeVersionImmutableError(version.status);
    }

    await getKnowledgeCitationRepository().delete(citationId);

    await getKnowledgeAuditService().record({
      eventType: 'CITATION_REMOVED',
      entityId: version.entityId,
      versionId: version.id,
      ...(actor ? { actor } : {}),
      detail: { citationId },
    });
  }

  // ── Reviews ─────────────────────────────────────────────────────────────

  async listEditorialQueue(): Promise<KnowledgeVersionDto[]> {
    const rows = await getKnowledgeVersionRepository().listEditorialQueue();
    return rows.map((r) => toKnowledgeVersionDto(r));
  }

  async completeReview(
    input: CompleteKnowledgeReviewInput,
    actor?: FoundationActor,
  ): Promise<KnowledgeVersionDto> {
    const review = await getKnowledgeReviewRepository().findById(input.reviewId);
    if (!review) {
      throw new KnowledgeWorkflowError('REVIEW_NOT_FOUND', 'Review not found');
    }

    await getKnowledgeReviewRepository().completeReview(input);

    let nextStatus = review.version.status;
    if (input.decision === 'REQUEST_CHANGES') {
      nextStatus = 'CHANGES_REQUESTED';
    } else if (input.decision === 'REJECT') {
      nextStatus = 'REJECTED';
    } else if (input.decision === 'APPROVE') {
      if (requiresVetApproval(review.version.clinicalRiskTier)) {
        nextStatus = 'VET_APPROVAL';
        await getKnowledgeReviewRepository().openReview({
          versionId: review.versionId,
          stage: 'VET',
          queueSource: 'MANUAL',
        });
      }
      // LOW/MEDIUM: remain IN_REVIEW — publish allowed after editorial approve
    }

    const updated = await getKnowledgeVersionRepository().updateStatus(review.versionId, nextStatus);

    await getKnowledgeAuditService().record({
      eventType: 'REVIEW_COMPLETED',
      entityId: review.version.entityId,
      versionId: review.versionId,
      ...(actor ? { actor } : {}),
      detail: { decision: input.decision, stage: review.stage },
    });

    return toKnowledgeVersionDto(updated);
  }

  // ── Approvals ───────────────────────────────────────────────────────────

  async listVetQueue(): Promise<KnowledgeVersionDto[]> {
    const rows = await getKnowledgeVersionRepository().listVetQueue();
    return rows.map((r) => toKnowledgeVersionDto(r));
  }

  async recordApproval(
    input: RecordKnowledgeApprovalInput,
    actor?: FoundationActor,
  ): Promise<{ approval: KnowledgeApprovalDto; version: KnowledgeVersionDto }> {
    const version = await getKnowledgeVersionRepository().requireVersion(input.versionId);
    if (version.status !== 'VET_APPROVAL' && version.status !== 'IN_REVIEW') {
      throw new KnowledgeWorkflowError('INVALID_STATUS', 'Version is not awaiting vet approval');
    }

    await getKnowledgeChunkingOrchestratorService().processVersion({
      versionId: input.versionId,
      finalizeEvidence: true,
      assessorId: input.approverVetId,
    });

    const versionAfter = await getKnowledgeVersionRepository().requireVersion(input.versionId);
    const citations = filterVersionLevelSignOffCitations(
      await getKnowledgeCitationRepository().listByVersion(input.versionId),
    );
    const signOffHash = computeVersionSignOffHash(versionAfter, citations);

    const approval = await getKnowledgeApprovalRepository().create({
      ...input,
      signOffHash,
    });

    await getKnowledgeVersionRepository().updateStatus(input.versionId, 'VET_APPROVAL');

    await getKnowledgeAuditService().record({
      eventType: 'APPROVAL_RECORDED',
      entityId: version.entityId,
      versionId: input.versionId,
      ...(actor ? { actor } : {}),
      detail: { approverVetId: input.approverVetId, signOffHash },
    });

    return {
      approval: toKnowledgeApprovalDto(approval),
      version: toKnowledgeVersionDto(versionAfter),
    };
  }

  async publishVersion(
    versionId: string,
    actor?: FoundationActor,
  ): Promise<KnowledgeVersionDto> {
    const version = await getKnowledgeVersionRepository().requireVersion(versionId);
    const citationsForTrust = await getKnowledgeCitationRepository().listByVersion(versionId);

    if (citationsForTrust.length < 1) {
      throw new KnowledgeWorkflowError('CITATION_REQUIRED', 'Cannot publish without citations');
    }
    this.assertCitationTrust(version, citationsForTrust);

    if (requiresVetApproval(version.clinicalRiskTier)) {
      const approval = await getKnowledgeApprovalRepository().findLatestValid(versionId);
      if (!approval) {
        throw new KnowledgeWorkflowError('VET_APPROVAL_REQUIRED', 'Vet approval required for this version');
      }
      const signOffCitations = filterVersionLevelSignOffCitations(citationsForTrust);
      const currentHash = computeVersionSignOffHash(version, signOffCitations);
      if (approval.signOffHash && approval.signOffHash !== currentHash) {
        throw new KnowledgeWorkflowError(
          'SIGNOFF_STALE',
          'Version content changed after veterinary sign-off',
        );
      }
    }

    if (version.status !== 'VET_APPROVAL' && version.status !== 'IN_REVIEW') {
      throw new KnowledgeWorkflowError('INVALID_STATUS', `Cannot publish from status ${version.status}`);
    }

    const chunkOrchestrator = getKnowledgeChunkingOrchestratorService();
    const stagingChunks = await getKnowledgeChunkRepository().listByVersion(versionId, 'STAGING');
    if (stagingChunks.length === 0) {
      await chunkOrchestrator.processVersion({ versionId });
    }
    await chunkOrchestrator.promotePublishedChunks(versionId);

    const entity = await getKnowledgeEntityRepository().requireEntity(version.entityId);
    const priorPublishedId = entity.currentPublishedVersionId;

    if (priorPublishedId) {
      await getKnowledgeVersionRepository().updateStatus(priorPublishedId, 'DEPRECATED', {
        deprecatedAt: new Date(),
        deprecationReason: `Superseded by version ${version.versionNumber}`,
      });
      await getKnowledgeAuditService().record({
        eventType: 'VERSION_DEPRECATED',
        entityId: version.entityId,
        versionId: priorPublishedId,
        ...(actor ? { actor } : {}),
        detail: { supersededByVersionId: versionId, versionNumber: version.versionNumber },
      });
    }

    const published = await getKnowledgeVersionRepository().updateStatus(versionId, 'PUBLISHED', {
      publishedAt: new Date(),
      ...(actor?.id ? { publishedById: actor.id } : {}),
    });

    await getKnowledgeEntityRepository().updatePointers(version.entityId, {
      currentPublishedVersionId: versionId,
      currentDraftVersionId: entity.currentDraftVersionId === versionId ? null : entity.currentDraftVersionId,
    });

    await getKnowledgeAuditService().record({
      eventType: 'VERSION_PUBLISHED',
      entityId: version.entityId,
      versionId,
      ...(actor ? { actor } : {}),
      detail: {
        versionNumber: version.versionNumber,
        priorPublishedVersionId: priorPublishedId,
        foundationSchemaVersion: '6b1.0',
      },
    });

    try {
      await getVkLegacyRagSyncService().syncPublishedVersion(versionId);
    } catch (syncError) {
      await getKnowledgeAuditService().record({
        eventType: 'VERSION_PUBLISHED',
        entityId: version.entityId,
        versionId,
        ...(actor ? { actor } : {}),
        detail: {
          legacySyncFailed: true,
          error: syncError instanceof Error ? syncError.message : String(syncError),
        },
      });
    }

    try {
      const { getGraphSyncService } = await import('../uvkg/services/graph-sync.service.js');
      const { resolveUvkgConfig } = await import('../uvkg/config/uvkg-config.js');
      if (resolveUvkgConfig().syncEnabled) {
        await getGraphSyncService().syncForPublishedVersion(versionId);
      }
    } catch (uvkgSyncError) {
      await getKnowledgeAuditService().record({
        eventType: 'VERSION_PUBLISHED',
        entityId: version.entityId,
        versionId,
        ...(actor ? { actor } : {}),
        detail: {
          uvkgSyncFailed: true,
          error: uvkgSyncError instanceof Error ? uvkgSyncError.message : String(uvkgSyncError),
        },
      });
    }

    return toKnowledgeVersionDto(published);
  }

  async listAudit(limit = 100) {
    return getKnowledgeAuditService().listRecent(limit);
  }
}

let service: KnowledgeFoundationService | null = null;

export function getKnowledgeFoundationService(): KnowledgeFoundationService {
  if (!service) service = new KnowledgeFoundationService();
  return service;
}

export function resetKnowledgeFoundationServiceForTests(): void {
  service = null;
}
