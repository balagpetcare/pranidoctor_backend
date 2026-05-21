import { describe, expect, it, vi, beforeEach } from 'vitest';

const upsertSession = vi.fn();
const enqueueItem = vi.fn();
const listPendingItems = vi.fn();
const refreshSessionCounts = vi.fn();
const findItemByKey = vi.fn();

vi.mock('./repository/offline.repository.js', () => ({
  getOfflineRepository: () => ({
    upsertSession,
    enqueueItem,
    listPendingItems,
    refreshSessionCounts,
    findItemByKey,
    countConflicts: vi.fn().mockResolvedValue(0),
  }),
}));

const processItem = vi.fn();

vi.mock('./sync/sync-engine.service.js', () => ({
  getSyncEngineService: () => ({ processItem }),
}));

import { OfflineArchitectureService } from './offline-architecture.service.js';

describe('offline sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertSession.mockResolvedValue({ id: 'sess1', pendingCount: 0, deadCount: 0 });
    refreshSessionCounts.mockResolvedValue({});
    listPendingItems.mockResolvedValue([]);
    processItem.mockResolvedValue({
      idempotencyKey: 'k1',
      status: 'SYNCED',
      serverEntityId: 'lead1',
      conflict: false,
      resolution: null,
      error: null,
    });
  });

  it('enqueues new offline items before processing', async () => {
    findItemByKey.mockResolvedValue(null);
    enqueueItem.mockResolvedValue({ id: 'item1' });
    listPendingItems.mockResolvedValue([
      {
        id: 'item1',
        idempotencyKey: 'lead-local-1',
        entityType: 'OFFLINE_LEAD',
        operation: 'UPSERT',
        payloadJson: { clientLeadId: 'c1', phone: '01700000000' },
        clientSequence: 1,
      },
    ]);

    const service = new OfflineArchitectureService();
    const result = await service.sync('user1', {
      items: [
        {
          idempotencyKey: 'lead-local-1',
          entityType: 'OFFLINE_LEAD',
          payload: { clientLeadId: 'c1', phone: '01700000000' },
          clientSequence: 1,
        },
      ],
    });

    expect(enqueueItem).toHaveBeenCalled();
    expect(result.synced).toBe(1);
  });
});
