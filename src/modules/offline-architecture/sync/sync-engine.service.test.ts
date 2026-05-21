import { describe, expect, it, vi, beforeEach } from 'vitest';

const updateItem = vi.fn();
const createConflictRecord = vi.fn();
const createOfflineLeadDraft = vi.fn();
const syncOfflineLead = vi.fn();
const getCustomerProfileUpdatedAt = vi.fn();
const findItemByKey = vi.fn();

vi.mock('../repository/offline.repository.js', () => ({
  getOfflineRepository: () => ({
    updateItem,
    createConflictRecord,
    createOfflineLeadDraft,
    syncOfflineLead,
    getCustomerProfileUpdatedAt,
    findItemByKey,
  }),
}));

import { SyncEngineService } from './sync-engine.service.js';

describe('sync-engine offline lead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateItem.mockResolvedValue({});
    createOfflineLeadDraft.mockResolvedValue({ id: 'draft1' });
    syncOfflineLead.mockResolvedValue({ leadId: 'lead1' });
    getCustomerProfileUpdatedAt.mockResolvedValue(null);
  });

  it('creates unassigned lead on offline sync', async () => {
    findItemByKey.mockResolvedValue({
      id: 'item1',
      idempotencyKey: 'lead-1',
      entityType: 'OFFLINE_LEAD',
      operation: 'UPSERT',
      payloadJson: { clientLeadId: 'c1', phone: '01711111111', concern: 'fever' },
      clientSequence: 1,
      attemptCount: 0,
      maxAttempts: 5,
      status: 'PENDING',
    });

    const engine = new SyncEngineService();
    const result = await engine.processItem('user1', 'item1', {
      idempotencyKey: 'lead-1',
      entityType: 'OFFLINE_LEAD',
      payload: { clientLeadId: 'c1', phone: '01711111111', concern: 'fever' },
      clientSequence: 1,
    });

    expect(syncOfflineLead).toHaveBeenCalled();
    expect(result.status).toBe('SYNCED');
    expect(result.serverEntityId).toBe('lead1');
  });
});

describe('sync-engine conflict recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateItem.mockResolvedValue({});
    createConflictRecord.mockResolvedValue({});
    getCustomerProfileUpdatedAt.mockResolvedValue('server-v2');
  });

  it('marks auth snapshot conflict as SERVER_WINS', async () => {
    findItemByKey.mockResolvedValue({
      id: 'item2',
      idempotencyKey: 'auth-1',
      entityType: 'AUTH_SNAPSHOT',
      operation: 'UPSERT',
      payloadJson: {},
      clientSequence: 1,
      attemptCount: 0,
      maxAttempts: 5,
      status: 'PENDING',
    });

    const engine = new SyncEngineService();
    const result = await engine.processItem('user1', 'item2', {
      idempotencyKey: 'auth-1',
      entityType: 'AUTH_SNAPSHOT',
      payload: {},
      clientSequence: 1,
      clientVersion: 'v1',
      serverVersion: 'v2',
    });

    expect(result.status).toBe('CONFLICT');
    expect(result.resolution).toBe('SERVER_WINS');
  });
});
