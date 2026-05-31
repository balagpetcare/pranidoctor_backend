import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  vkKnowledgeAuditEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

const vkfAuditRecord = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => prismaMock,
}));

vi.mock('../knowledge-foundation/audit/knowledge-audit.service.js', () => ({
  getKnowledgeAuditService: () => ({
    record: vkfAuditRecord,
  }),
}));

describe('KnowledgeImportAuditService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetKnowledgeImportAuditForTests } = await import('./audit/knowledge-import-audit.service.js');
    const { resetKnowledgeImportAuditRepositoryForTests } = await import(
      './audit/knowledge-import-audit.repository.js'
    );
    resetKnowledgeImportAuditForTests();
    resetKnowledgeImportAuditRepositoryForTests();
    prismaMock.vkKnowledgeAuditEvent.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('persists all KIP events to VkKnowledgeAuditEvent', async () => {
    const { getKnowledgeImportAuditService } = await import('./audit/knowledge-import-audit.service.js');

    await getKnowledgeImportAuditService().record({
      eventType: 'IMPORT_RUN_STARTED',
      importRunId: 'run-1',
      detail: { sourceId: 'src-1' },
    });

    expect(prismaMock.vkKnowledgeAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'IMPORT_RUN_STARTED',
          detailJson: expect.objectContaining({ importRunId: 'run-1' }),
        }),
      }),
    );
  });

  it('dual-writes VKF audit for version lifecycle events', async () => {
    const { getKnowledgeImportAuditService } = await import('./audit/knowledge-import-audit.service.js');

    await getKnowledgeImportAuditService().record({
      eventType: 'IMPORT_VERSION_CREATED',
      importRunId: 'run-1',
      entityId: 'ent-1',
      versionId: 'ver-1',
    });

    expect(vkfAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ENTITY_CREATED',
        entityId: 'ent-1',
        versionId: 'ver-1',
      }),
    );
  });
});
