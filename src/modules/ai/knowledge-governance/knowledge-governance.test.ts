import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VkKnowledgeEntity, VkKnowledgeVersion } from '../../../generated/prisma/index.js';
import { resolveGovernanceStage, requiredReviewStages } from './stages/governance-stage.resolver.js';
import {
  requiresVetReviewPath,
  isExpeditedEligible,
  assertVetScope,
} from './policy/vet-path.policy.js';
import { computeApprovalValidUntil } from './policy/expiration-policy.registry.js';

describe('governance-stage.resolver', () => {
  it('maps technical statuses to business stages', () => {
    expect(
      resolveGovernanceStage({
        status: 'DRAFT',
        hasOpenReview: false,
        hasOpenVetReview: false,
        hasValidApproval: false,
        hasExpeditedApproval: false,
      }),
    ).toBe('DRAFT');

    expect(
      resolveGovernanceStage({
        status: 'IN_REVIEW',
        hasOpenReview: true,
        hasOpenVetReview: false,
        hasValidApproval: false,
        hasExpeditedApproval: false,
      }),
    ).toBe('REVIEW');

    expect(
      resolveGovernanceStage({
        status: 'VET_APPROVAL',
        hasOpenReview: false,
        hasOpenVetReview: true,
        hasValidApproval: false,
        hasExpeditedApproval: false,
      }),
    ).toBe('VET_REVIEW');

    expect(
      resolveGovernanceStage({
        status: 'VET_APPROVAL',
        hasOpenReview: false,
        hasOpenVetReview: false,
        hasValidApproval: true,
        hasExpeditedApproval: false,
      }),
    ).toBe('APPROVAL');

    expect(
      resolveGovernanceStage({
        status: 'PUBLISHED',
        hasOpenReview: false,
        hasOpenVetReview: false,
        hasValidApproval: false,
        hasExpeditedApproval: false,
      }),
    ).toBe('PUBLISHED');

    expect(
      resolveGovernanceStage({
        status: 'REJECTED',
        hasOpenReview: false,
        hasOpenVetReview: false,
        hasValidApproval: false,
        hasExpeditedApproval: false,
      }),
    ).toBe('ARCHIVED');

    expect(
      resolveGovernanceStage({
        status: 'IN_REVIEW',
        hasOpenReview: false,
        hasOpenVetReview: false,
        hasValidApproval: false,
        hasExpeditedApproval: false,
        hasEditorialApprovalReady: true,
      }),
    ).toBe('APPROVAL');
  });

  it('includes locale stages for farmer audience', () => {
    const stages = requiredReviewStages({ audience: 'FARMER' });
    expect(stages).toContain('EDITORIAL');
    expect(stages).toContain('LANGUAGE_BN');
    expect(stages).toContain('DOMAIN_LEAD');
  });
});

describe('vet-path.policy', () => {
  it('requires vet for HIGH risk and clinical domains', () => {
    expect(requiresVetReviewPath({ clinicalRiskTier: 'HIGH', domain: 'FEED' })).toBe(true);
    expect(requiresVetReviewPath({ clinicalRiskTier: 'LOW', domain: 'MEDICINE' })).toBe(true);
    expect(requiresVetReviewPath({ clinicalRiskTier: 'LOW', domain: 'FARM_MGMT' })).toBe(false);
  });

  it('identifies expedited LOW farm content', () => {
    expect(isExpeditedEligible({ clinicalRiskTier: 'LOW', domain: 'FARM_MGMT' })).toBe(true);
    expect(isExpeditedEligible({ clinicalRiskTier: 'HIGH', domain: 'FARM_MGMT' })).toBe(false);
  });

  it('validates vet scope against domain', () => {
    expect(assertVetScope({ domain: 'MEDICINE', approvalScope: ['MEDICINE'] })).toBe(true);
    expect(assertVetScope({ domain: 'MEDICINE', approvalScope: ['FEED'] })).toBe(false);
  });
});

describe('expiration-policy.registry', () => {
  it('computes regulatory shorter validity than clinical default', () => {
    const regulatory = computeApprovalValidUntil({
      domain: 'REGULATORY_BD',
      clinicalRiskTier: 'HIGH',
      from: new Date('2026-01-01T00:00:00Z'),
    });
    const clinical = computeApprovalValidUntil({
      domain: 'DISEASE',
      clinicalRiskTier: 'HIGH',
      from: new Date('2026-01-01T00:00:00Z'),
    });
    expect(regulatory.getTime()).toBeLessThan(clinical.getTime());
  });
});

const auditRecord = vi.fn().mockResolvedValue(undefined);

const versionRepoMock = {
  requireVersion: vi.fn(),
  findPlainById: vi.fn(),
  updateStatus: vi.fn(),
  listEditorialQueue: vi.fn().mockResolvedValue([]),
  listVetQueue: vi.fn().mockResolvedValue([]),
};

const citationRepoMock = {
  countByVersion: vi.fn(),
  listByVersion: vi.fn(),
};

const reviewRepoMock = {
  openReview: vi.fn().mockResolvedValue({ id: 'rev-1' }),
  findById: vi.fn(),
  completeReview: vi.fn().mockResolvedValue(undefined),
  listOpenForVersion: vi.fn().mockResolvedValue([]),
  hasApprovedStage: vi.fn().mockResolvedValue(false),
  listCompletedForVersion: vi.fn().mockResolvedValue([]),
};

const approvalRepoMock = {
  create: vi.fn().mockResolvedValue({ id: 'appr-1' }),
  findLatestValid: vi.fn(),
};

const entityRepoMock = {
  requireEntity: vi.fn(),
  updatePointers: vi.fn().mockResolvedValue(undefined),
};

const changeRequestRepoMock = {
  create: vi.fn().mockResolvedValue({ id: 'cr-1' }),
  findById: vi.fn(),
  listOpenForVersion: vi.fn().mockResolvedValue([]),
  updateChecklist: vi.fn(),
  markResolved: vi.fn(),
};

const conflictRepoMock = {
  listOpenForVersion: vi.fn().mockResolvedValue([]),
  hasBlockingConflict: vi.fn().mockResolvedValue(false),
  create: vi.fn(),
  findById: vi.fn(),
  resolve: vi.fn(),
};

vi.mock('../knowledge-foundation/audit/knowledge-audit.service.js', () => ({
  getKnowledgeAuditService: () => ({ record: auditRecord, listRecent: vi.fn() }),
}));

vi.mock('../knowledge-foundation/repositories/knowledge-version.repository.js', () => ({
  getKnowledgeVersionRepository: () => versionRepoMock,
}));

vi.mock('../knowledge-foundation/repositories/knowledge-citation.repository.js', () => ({
  getKnowledgeCitationRepository: () => citationRepoMock,
}));

vi.mock('../knowledge-foundation/repositories/knowledge-review.repository.js', () => ({
  getKnowledgeReviewRepository: () => reviewRepoMock,
}));

vi.mock('../knowledge-foundation/repositories/knowledge-approval.repository.js', () => ({
  getKnowledgeApprovalRepository: () => approvalRepoMock,
}));

vi.mock('../knowledge-foundation/repositories/knowledge-entity.repository.js', () => ({
  getKnowledgeEntityRepository: () => entityRepoMock,
}));

vi.mock('../knowledge-foundation/knowledge-foundation.service.js', () => ({
  getKnowledgeFoundationService: () => ({
    publishVersion: vi.fn().mockResolvedValue({ id: 'ver-1', status: 'PUBLISHED' }),
  }),
}));

vi.mock('../knowledge-chunking/index.js', () => ({
  getKnowledgeChunkingOrchestratorService: () => ({
    processVersion: vi.fn().mockResolvedValue({ chunkCount: 1 }),
    promotePublishedChunks: vi.fn(),
  }),
}));

vi.mock('./repositories/change-request.repository.js', () => ({
  getChangeRequestRepository: () => changeRequestRepoMock,
}));

vi.mock('./repositories/governance-conflict.repository.js', () => ({
  getGovernanceConflictRepository: () => conflictRepoMock,
}));

function mockVersion(overrides: Partial<VkKnowledgeVersion> = {}): VkKnowledgeVersion {
  const now = new Date();
  return {
    id: 'ver-1',
    entityId: 'ent-1',
    versionNumber: 1,
    supersedesVersionId: null,
    status: 'DRAFT',
    titleBn: 'বাংলা',
    titleEn: 'English',
    summaryBn: null,
    summaryEn: null,
    bodyBn: 'bn body',
    bodyEn: 'en body',
    species: [],
    audience: 'FARMER',
    regionScope: 'BD',
    structuredJson: null,
    keywordsBn: [],
    keywordsEn: [],
    colloquialBn: [],
    searchText: null,
    chunkPolicyId: null,
    clinicalRiskTier: 'LOW',
    embeddingStatus: 'NOT_APPLICABLE',
    changeSummary: null,
    changedFields: [],
    diffJson: null,
    aiGeneratedDraft: false,
    importRunId: null,
    publishedAt: null,
    deprecatedAt: null,
    deprecationReason: null,
    createdById: null,
    publishedById: null,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function mockEntity(overrides: Partial<VkKnowledgeEntity> = {}): VkKnowledgeEntity {
  const now = new Date();
  return {
    id: 'ent-1',
    domain: 'FARM_MGMT',
    entityType: 'guide',
    slug: 'feed-guide',
    currentPublishedVersionId: null,
    currentDraftVersionId: 'ver-1',
    legacyEntryId: null,
    createdById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function mockCitation() {
  return {
    id: 'cit-1',
    pageRef: '1',
    sectionRef: null,
    source: { trustTier: 2 },
    inlineCitationKey: '[src|1]',
  };
}

describe('KnowledgeGovernanceOrchestratorService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    entityRepoMock.requireEntity.mockResolvedValue(mockEntity());
    const { resetKnowledgeGovernanceOrchestratorServiceForTests } = await import(
      './knowledge-governance-orchestrator.service.js'
    );
    resetKnowledgeGovernanceOrchestratorServiceForTests();
  });

  it('submits draft to review with chunk processing and audit', async () => {
    const version = mockVersion();
    versionRepoMock.requireVersion.mockResolvedValue({
      ...version,
      entity: mockEntity(),
    });
    citationRepoMock.countByVersion.mockResolvedValue(1);
    citationRepoMock.listByVersion.mockResolvedValue([mockCitation()]);
    versionRepoMock.updateStatus.mockResolvedValue(mockVersion({ status: 'IN_REVIEW' }));

    const { getKnowledgeGovernanceOrchestratorService } = await import(
      './knowledge-governance-orchestrator.service.js'
    );
    const result = await getKnowledgeGovernanceOrchestratorService().submitForReview(
      { versionId: 'ver-1' },
      { id: 'editor-1', role: 'ADMIN' },
    );

    expect(result.status).toBe('IN_REVIEW');
    expect(reviewRepoMock.openReview).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'EDITORIAL' }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'GOVERNANCE_STAGE_CHANGED' }),
    );
  });

  it('opens change request and returns to draft on REQUEST_CHANGES', async () => {
    const version = mockVersion({ status: 'IN_REVIEW' });
    reviewRepoMock.findById.mockResolvedValue({
      id: 'rev-1',
      versionId: 'ver-1',
      stage: 'EDITORIAL',
      version: { ...version, entity: mockEntity() },
    });
    versionRepoMock.requireVersion.mockResolvedValue({ ...version, entity: mockEntity() });
    versionRepoMock.findPlainById.mockResolvedValue(version);
    versionRepoMock.updateStatus.mockResolvedValue(mockVersion({ status: 'CHANGES_REQUESTED' }));
    changeRequestRepoMock.create.mockResolvedValue({ id: 'cr-1' });

    const { getKnowledgeGovernanceOrchestratorService } = await import(
      './knowledge-governance-orchestrator.service.js'
    );
    const result = await getKnowledgeGovernanceOrchestratorService().completeReview(
      {
        reviewId: 'rev-1',
        decision: 'REQUEST_CHANGES',
        reviewerId: 'reviewer-1',
        comments: 'Fix citations',
      },
      { id: 'reviewer-1', role: 'ADMIN' },
    );

    expect(result.status).toBe('CHANGES_REQUESTED');
    expect(changeRequestRepoMock.create).toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'CHANGE_REQUEST_OPENED' }),
    );
  });

  it('routes HIGH risk to vet review after all editorial stages approve', async () => {
    const version = mockVersion({ status: 'IN_REVIEW', clinicalRiskTier: 'HIGH', audience: 'DOCTOR' });
    reviewRepoMock.findById.mockResolvedValue({
      id: 'rev-dl',
      versionId: 'ver-1',
      stage: 'DOMAIN_LEAD',
      version: { ...version, entity: mockEntity({ domain: 'DISEASE' }) },
    });
    reviewRepoMock.hasApprovedStage.mockResolvedValue(true);
    versionRepoMock.requireVersion.mockResolvedValue({
      ...version,
      entity: mockEntity({ domain: 'DISEASE' }),
    });
    versionRepoMock.findPlainById.mockResolvedValue(version);
    versionRepoMock.updateStatus.mockResolvedValue(mockVersion({ status: 'VET_APPROVAL' }));

    const { getKnowledgeGovernanceOrchestratorService } = await import(
      './knowledge-governance-orchestrator.service.js'
    );
    const result = await getKnowledgeGovernanceOrchestratorService().completeReview(
      { reviewId: 'rev-dl', decision: 'APPROVE', reviewerId: 'lead-1' },
      { id: 'lead-1', role: 'ADMIN' },
    );

    expect(result.status).toBe('VET_APPROVAL');
    expect(reviewRepoMock.openReview).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'VET' }),
    );
  });

  it('blocks publish when not in approval stage', async () => {
    versionRepoMock.requireVersion.mockResolvedValue({
      ...mockVersion({ status: 'IN_REVIEW' }),
      entity: mockEntity(),
    });
    versionRepoMock.findPlainById.mockResolvedValue(mockVersion({ status: 'IN_REVIEW' }));
    reviewRepoMock.listOpenForVersion.mockResolvedValue([{ stage: 'EDITORIAL' }]);
    approvalRepoMock.findLatestValid.mockResolvedValue(null);
    reviewRepoMock.hasApprovedStage.mockResolvedValue(false);

    const { getKnowledgeGovernanceOrchestratorService } = await import(
      './knowledge-governance-orchestrator.service.js'
    );
    await expect(
      getKnowledgeGovernanceOrchestratorService().publish({ versionId: 'ver-1' }),
    ).rejects.toMatchObject({ code: 'NOT_APPROVAL_READY' });
  });

  it('archives rejected version with audit trail', async () => {
    versionRepoMock.requireVersion.mockResolvedValue({
      ...mockVersion({ status: 'IN_REVIEW' }),
      entity: mockEntity(),
    });
    versionRepoMock.findPlainById.mockResolvedValue(mockVersion({ status: 'IN_REVIEW' }));
    versionRepoMock.updateStatus.mockResolvedValue(mockVersion({ status: 'REJECTED' }));

    const { getKnowledgeGovernanceOrchestratorService } = await import(
      './knowledge-governance-orchestrator.service.js'
    );
    const result = await getKnowledgeGovernanceOrchestratorService().archive(
      { versionId: 'ver-1', reason: 'Not suitable', archiveType: 'REJECT' },
      { id: 'admin-1', role: 'SUPER_ADMIN' },
    );

    expect(result.status).toBe('REJECTED');
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'VERSION_ARCHIVED' }),
    );
  });

  it('enforces separation of duties on vet approval', async () => {
    const version = mockVersion({ status: 'VET_APPROVAL', clinicalRiskTier: 'HIGH' });
    versionRepoMock.requireVersion.mockResolvedValue({ ...version, entity: mockEntity({ domain: 'DISEASE' }) });
    entityRepoMock.requireEntity.mockResolvedValue(mockEntity({ domain: 'DISEASE' }));
    reviewRepoMock.listCompletedForVersion.mockResolvedValue([{ reviewerId: 'vet-1' }]);

    const { getKnowledgeGovernanceOrchestratorService } = await import(
      './knowledge-governance-orchestrator.service.js'
    );
    await expect(
      getKnowledgeGovernanceOrchestratorService().recordVetApproval({
        versionId: 'ver-1',
        approverVetId: 'vet-1',
        vetLicenseNo: 'BD-123',
        approvalScope: ['DISEASE'],
      }),
    ).rejects.toMatchObject({ code: 'SEPARATION_OF_DUTIES' });
  });

  it('allows publish when MEDIUM editorial path reaches approval stage', async () => {
    const version = mockVersion({ status: 'IN_REVIEW', clinicalRiskTier: 'MEDIUM', audience: 'DOCTOR' });
    versionRepoMock.requireVersion.mockResolvedValue({
      ...version,
      entity: mockEntity({ domain: 'VACCINE' }),
    });
    versionRepoMock.findPlainById.mockResolvedValue(version);
    reviewRepoMock.listOpenForVersion.mockResolvedValue([]);
    reviewRepoMock.hasApprovedStage.mockResolvedValue(true);
    approvalRepoMock.findLatestValid.mockResolvedValue(null);
    entityRepoMock.requireEntity.mockResolvedValue(mockEntity({ domain: 'VACCINE' }));
    citationRepoMock.listByVersion.mockResolvedValue([mockCitation()]);

    const { getKnowledgeGovernanceOrchestratorService } = await import(
      './knowledge-governance-orchestrator.service.js'
    );
    const stage = await getKnowledgeGovernanceOrchestratorService().getGovernanceStage('ver-1');
    expect(stage).toBe('APPROVAL');

    const published = await getKnowledgeGovernanceOrchestratorService().publish(
      { versionId: 'ver-1' },
      { id: 'pub-1', role: 'SUPER_ADMIN' },
    );
    expect(published.status).toBe('PUBLISHED');
  });
});
