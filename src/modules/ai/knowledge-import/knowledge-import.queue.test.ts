import { beforeEach, describe, expect, it, vi } from 'vitest';

const repoMock = {
  create: vi.fn(),
  claimNext: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
};

vi.mock('./repositories/import-job.repository.js', () => ({
  getImportJobRepository: () => repoMock,
}));

vi.mock('./audit/knowledge-import-audit.service.js', () => ({
  getKnowledgeImportAuditService: () => ({ record: vi.fn().mockResolvedValue(undefined) }),
}));

describe('KnowledgeImportQueueService retry', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetKnowledgeImportQueueForTests } = await import('./queues/knowledge-import-queue.service.js');
    resetKnowledgeImportQueueForTests();
  });

  it('schedules retry on processor failure', async () => {
    repoMock.claimNext.mockResolvedValue({
      id: 'job-1',
      payloadJson: { importRunId: 'run-1', stage: 'IMPORT' },
      maxAttempts: 3,
      attemptCount: 1,
    });
    repoMock.fail.mockResolvedValue({ willRetry: true, job: { id: 'job-1' } });

    const { getKnowledgeImportQueueService } = await import('./queues/knowledge-import-queue.service.js');

    await expect(
      getKnowledgeImportQueueService().processNextJob('run-1', async () => {
        throw new Error('transient failure');
      }),
    ).rejects.toThrow('transient failure');

    expect(repoMock.fail).toHaveBeenCalledWith('job-1', 'transient failure', 3, 1);
  });

  it('completes job on success', async () => {
    repoMock.claimNext.mockResolvedValue({
      id: 'job-2',
      payloadJson: { importRunId: 'run-1', stage: 'VALIDATE' },
      maxAttempts: 3,
      attemptCount: 1,
    });
    repoMock.complete.mockResolvedValue({});

    const { getKnowledgeImportQueueService } = await import('./queues/knowledge-import-queue.service.js');

    const processed = await getKnowledgeImportQueueService().processNextJob('run-1', async () => ({
      ok: true,
    }));

    expect(processed).toBe(true);
    expect(repoMock.complete).toHaveBeenCalledWith('job-2', { ok: true });
  });
});
