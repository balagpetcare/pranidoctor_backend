import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  aiKnowledgeSource: { findUnique: vi.fn() },
  aiKnowledgeImportRun: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  aiKnowledgeImportJob: { create: vi.fn() },
  aiKnowledgeValidationItem: { createMany: vi.fn(), findMany: vi.fn() },
  aiKnowledgeQuarantineRecord: { create: vi.fn() },
  vkKnowledgeEntity: { findUnique: vi.fn() },
  vkKnowledgeVersion: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => prismaMock,
}));

vi.mock('./audit/knowledge-import-audit.service.js', () => ({
  getKnowledgeImportAuditService: () => ({ record: vi.fn().mockResolvedValue(undefined) }),
  resetKnowledgeImportAuditForTests: vi.fn(),
}));

vi.mock('./repositories/validation-item.repository.js', () => ({
  getValidationItemRepository: () => ({
    createBatch: vi.fn().mockResolvedValue(undefined),
    markByExtractIndex: vi.fn().mockResolvedValue(null),
  }),
  resetValidationItemRepositoryForTests: vi.fn(),
}));

vi.mock('./queues/knowledge-import-queue.service.js', () => ({
  getKnowledgeImportQueueService: () => ({
    enqueuePipeline: vi.fn().mockResolvedValue([]),
    finalizeJobs: vi.fn().mockResolvedValue({ count: 0 }),
  }),
  resetKnowledgeImportQueueForTests: vi.fn(),
}));

vi.mock('../knowledge-chunking/index.js', () => ({
  getKnowledgeChunkingOrchestratorService: () => ({
    processVersion: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('KnowledgeImportOrchestratorService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetAllKnowledgeImportForTests } = await import('./index.js');
    resetAllKnowledgeImportForTests();

    prismaMock.aiKnowledgeSource.findUnique.mockResolvedValue({
      id: 'src-1',
      sourceKey: 'feed-table',
      sourceClass: 'FEED_REFERENCE',
      trustTier: 3,
      license: { allowsAiExtraction: true, expiryDate: null },
      documents: [],
    });

    prismaMock.aiKnowledgeImportRun.create.mockResolvedValue({
      id: 'run-1',
      sourceId: 'src-1',
      dryRun: true,
      documentId: null,
    });

    prismaMock.aiKnowledgeImportRun.update.mockResolvedValue({});
    prismaMock.aiKnowledgeImportRun.findFirst.mockResolvedValue(null);
    prismaMock.aiKnowledgeValidationItem.createMany.mockResolvedValue({ count: 1 });
    prismaMock.aiKnowledgeValidationItem.findMany.mockResolvedValue([]);
    prismaMock.aiKnowledgeQuarantineRecord.create.mockResolvedValue({});
    prismaMock.aiKnowledgeImportJob.create.mockResolvedValue({ id: 'job-1' });
    prismaMock.vkKnowledgeEntity.findUnique.mockResolvedValue(null);

    prismaMock.aiKnowledgeImportRun.findUnique.mockResolvedValue({
      id: 'run-1',
      sourceId: 'src-1',
      dryRun: true,
      documentId: null,
      statsJson: { versionsCreated: 1 },
    });
  });

  it('runs dry-run import without writing versions', async () => {
    const { getKnowledgeImportOrchestratorService } = await import(
      './pipeline/knowledge-import-orchestrator.service.js'
    );

    const result = await getKnowledgeImportOrchestratorService().startImport({
      sourceId: 'src-1',
      dryRun: true,
      rows: [
        {
          slug: 'maize-feed',
          contentType: 'FEED',
          titleBn: 'ভুট্টা',
          titleEn: 'Maize',
          bodyBn: 'bn nutrients',
          bodyEn: 'en nutrients',
        },
      ],
    });

    expect(result.importRunId).toBe('run-1');
    expect(result.stats.versionsCreated).toBeGreaterThanOrEqual(1);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
