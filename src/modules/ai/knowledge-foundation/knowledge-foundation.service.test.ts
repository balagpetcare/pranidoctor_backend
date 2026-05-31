import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VkKnowledgeEntity, VkKnowledgeVersion } from '../../../generated/prisma/index.js';
import {
  KnowledgeVersionImmutableError,
  KnowledgeWorkflowError,
} from './knowledge-foundation.errors.js';

const auditRecord = vi.fn().mockResolvedValue(undefined);

const versionRepoMock = {
  requireVersion: vi.fn(),
  updateStatus: vi.fn(),
  updateDraft: vi.fn(),
  countByVersion: vi.fn(),
  listByVersion: vi.fn(),
};

const citationRepoMock = {
  countByVersion: vi.fn(),
  listByVersion: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
};

const reviewRepoMock = {
  openReview: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  completeReview: vi.fn().mockResolvedValue(undefined),
};

const approvalRepoMock = {
  create: vi.fn(),
  findLatestValid: vi.fn(),
};

const entityRepoMock = {
  requireEntity: vi.fn(),
  updatePointers: vi.fn().mockResolvedValue(undefined),
  findBySlug: vi.fn(),
  createWithInitialVersion: vi.fn(),
};

const sourceRepoMock = {
  require: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

vi.mock('./audit/knowledge-audit.service.js', () => ({
  getKnowledgeAuditService: () => ({ record: auditRecord, listRecent: vi.fn() }),
}));

vi.mock('./repositories/knowledge-version.repository.js', () => ({
  getKnowledgeVersionRepository: () => versionRepoMock,
}));

vi.mock('./repositories/knowledge-citation.repository.js', () => ({
  getKnowledgeCitationRepository: () => citationRepoMock,
}));

vi.mock('./repositories/knowledge-review.repository.js', () => ({
  getKnowledgeReviewRepository: () => reviewRepoMock,
}));

vi.mock('./repositories/knowledge-approval.repository.js', () => ({
  getKnowledgeApprovalRepository: () => approvalRepoMock,
}));

vi.mock('./repositories/knowledge-entity.repository.js', () => ({
  getKnowledgeEntityRepository: () => entityRepoMock,
}));

vi.mock('./repositories/knowledge-source.repository.js', () => ({
  getKnowledgeSourceRepository: () => sourceRepoMock,
}));

vi.mock('../knowledge-chunking/index.js', () => ({
  getKnowledgeChunkingOrchestratorService: () => ({
    processVersion: vi.fn().mockResolvedValue({ chunkCount: 1, confidenceScore: 0.5, provisional: true }),
    promotePublishedChunks: vi.fn().mockResolvedValue({ publishedChunkCount: 1, chunkIndexes: [0] }),
  }),
}));

vi.mock('../knowledge-chunking/repositories/knowledge-chunk.repository.js', () => ({
  getKnowledgeChunkRepository: () => ({
    listByVersion: vi.fn().mockResolvedValue([{ chunkIndex: 0 }]),
  }),
}));

function mockVersion(overrides: Partial<VkKnowledgeVersion> = {}): VkKnowledgeVersion {
  const now = new Date();
  return {
    id: 'ver-1',
    entityId: 'ent-1',
    versionNumber: 1,
    supersedesVersionId: null,
    status: 'DRAFT',
    titleBn: 'বাংলা শিরোনাম',
    titleEn: 'English title',
    summaryBn: null,
    summaryEn: null,
    bodyBn: 'বাংলা বিষয়বস্তু',
    bodyEn: 'English body',
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

function mockCitation(
  overrides: Partial<{
    id: string;
    pageRef: string | null;
    sectionRef: string | null;
    sourceTrustTier: number;
    inlineCitationKey: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'cit-1',
    pageRef: overrides.pageRef ?? '1',
    sectionRef: overrides.sectionRef ?? null,
    source: { trustTier: overrides.sourceTrustTier ?? 2 },
    inlineCitationKey: overrides.inlineCitationKey ?? '[src|1]',
  };
}

function mockEntity(overrides: Partial<VkKnowledgeEntity> = {}): VkKnowledgeEntity {
  const now = new Date();
  return {
    id: 'ent-1',
    domain: 'DISEASE',
    entityType: 'condition',
    slug: 'mastitis',
    currentPublishedVersionId: null,
    currentDraftVersionId: 'ver-1',
    legacyEntryId: null,
    createdById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('KnowledgeFoundationService workflows', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetKnowledgeFoundationServiceForTests } = await import('./knowledge-foundation.service.js');
    resetKnowledgeFoundationServiceForTests();
  });

  it('rejects submit without citations', async () => {
    const version = mockVersion();
    versionRepoMock.requireVersion.mockResolvedValue(version);
    citationRepoMock.countByVersion.mockResolvedValue(0);

    const { getKnowledgeFoundationService } = await import('./knowledge-foundation.service.js');
    await expect(getKnowledgeFoundationService().submitVersionForReview('ver-1')).rejects.toMatchObject({
      code: 'CITATION_REQUIRED',
    });
    expect(reviewRepoMock.openReview).not.toHaveBeenCalled();
  });

  it('rejects draft edit on published version', async () => {
    versionRepoMock.requireVersion.mockResolvedValue(mockVersion({ status: 'PUBLISHED' }));

    const { getKnowledgeFoundationService } = await import('./knowledge-foundation.service.js');
    await expect(
      getKnowledgeFoundationService().updateVersionDraft('ver-1', { titleBn: 'x' }),
    ).rejects.toBeInstanceOf(KnowledgeVersionImmutableError);
  });

  it('submits draft with citations and records audit events', async () => {
    const version = mockVersion();
    const submitted = mockVersion({ status: 'IN_REVIEW', submittedAt: new Date() });
    versionRepoMock.requireVersion.mockResolvedValue(version);
    citationRepoMock.countByVersion.mockResolvedValue(1);
    citationRepoMock.listByVersion.mockResolvedValue([mockCitation()]);
    versionRepoMock.updateStatus.mockResolvedValue(submitted);

    const { getKnowledgeFoundationService } = await import('./knowledge-foundation.service.js');
    const result = await getKnowledgeFoundationService().submitVersionForReview('ver-1', {
      id: 'editor-1',
      role: 'ADMIN',
    });

    expect(result.status).toBe('IN_REVIEW');
    expect(reviewRepoMock.openReview).toHaveBeenCalledWith(
      expect.objectContaining({ versionId: 'ver-1', stage: 'EDITORIAL' }),
    );
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'VERSION_SUBMITTED' }));
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'REVIEW_OPENED' }));
  });

  it('blocks publish for HIGH risk without vet approval', async () => {
    const version = mockVersion({
      status: 'IN_REVIEW',
      clinicalRiskTier: 'HIGH',
    });
    versionRepoMock.requireVersion.mockResolvedValue(version);
    citationRepoMock.countByVersion.mockResolvedValue(2);
    citationRepoMock.listByVersion.mockResolvedValue([
      mockCitation({ id: 'c1' }),
      mockCitation({ id: 'c2', pageRef: '2' }),
    ]);
    approvalRepoMock.findLatestValid.mockResolvedValue(null);

    const { getKnowledgeFoundationService } = await import('./knowledge-foundation.service.js');
    await expect(getKnowledgeFoundationService().publishVersion('ver-1')).rejects.toMatchObject({
      code: 'VET_APPROVAL_REQUIRED',
    });
  });

  it('publishes LOW risk version and deprecates prior published version', async () => {
    const version = mockVersion({ status: 'IN_REVIEW', clinicalRiskTier: 'LOW' });
    const published = mockVersion({ status: 'PUBLISHED', publishedAt: new Date() });
    const entity = mockEntity({ currentPublishedVersionId: 'ver-old' });

    versionRepoMock.requireVersion
      .mockResolvedValueOnce(version)
      .mockResolvedValueOnce(published);
    citationRepoMock.listByVersion.mockResolvedValue([mockCitation()]);
    entityRepoMock.requireEntity.mockResolvedValue(entity);
    versionRepoMock.updateStatus.mockImplementation(async (id: string, status: string) =>
      status === 'PUBLISHED' ? published : mockVersion({ id, status: status as VkKnowledgeVersion['status'] }),
    );

    const { getKnowledgeFoundationService } = await import('./knowledge-foundation.service.js');
    const result = await getKnowledgeFoundationService().publishVersion('ver-1', {
      id: 'pub-1',
      role: 'SUPER_ADMIN',
    });

    expect(result.status).toBe('PUBLISHED');
    expect(versionRepoMock.updateStatus).toHaveBeenCalledWith(
      'ver-old',
      'DEPRECATED',
      expect.objectContaining({ deprecationReason: expect.stringContaining('Superseded') }),
    );
    expect(entityRepoMock.updatePointers).toHaveBeenCalledWith(
      'ent-1',
      expect.objectContaining({ currentPublishedVersionId: 'ver-1' }),
    );
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'VERSION_PUBLISHED' }));
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'VERSION_DEPRECATED' }));
  });

  it('rejects entity create without BN-first content', async () => {
    const { getKnowledgeFoundationService } = await import('./knowledge-foundation.service.js');
    await expect(
      getKnowledgeFoundationService().createEntity({
        slug: 'test',
        domain: 'DISEASE',
        entityType: 'condition',
        titleBn: '',
        titleEn: 'En',
        bodyBn: 'bn',
        bodyEn: 'en',
      }),
    ).rejects.toBeInstanceOf(KnowledgeWorkflowError);
  });
});
