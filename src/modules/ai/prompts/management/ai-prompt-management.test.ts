import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiPromptStatus } from '../../../../generated/prisma/index.js';
import {
  AiPromptManagementService,
  resetAiPromptManagementServiceForTests,
} from './ai-prompt-management.service.js';
import { resetPromptVersionServiceForTests } from './prompt-version.service.js';
import { resolveAimsPromptKey, inferPromptKind } from './prompt-management.util.js';
import { PromptNotDraftError, PromptRollbackError } from './prompt-management.errors.js';

const aiPromptFindFirst = vi.fn();
const aiPromptFindMany = vi.fn();
const aiPromptCreate = vi.fn();
const aiPromptUpdate = vi.fn();
const aiPromptUpdateMany = vi.fn();
const transactionMock = vi.fn();

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiPrompt: {
      findFirst: aiPromptFindFirst,
      findMany: aiPromptFindMany,
      create: aiPromptCreate,
      update: aiPromptUpdate,
      updateMany: aiPromptUpdateMany,
    },
    $transaction: transactionMock,
  }),
}));

vi.mock('../../../../shared/monitoring/structured-logging.js', () => ({
  logAiExecution: vi.fn(),
}));

function resetPromptManagementForTests(): void {
  resetAiPromptManagementServiceForTests();
  resetPromptVersionServiceForTests();
  aiPromptFindFirst.mockReset();
  aiPromptFindMany.mockReset();
  aiPromptCreate.mockReset();
  aiPromptUpdate.mockReset();
  aiPromptUpdateMany.mockReset();
  transactionMock.mockReset();
}

const draftRow = {
  id: 'prompt-draft-1',
  scopeKey: 'platform',
  tenantId: null,
  branchId: null,
  promptKey: 'general_chat',
  version: 2,
  taskType: 'GENERAL_CHAT',
  name: 'General Chat',
  description: null,
  systemBn: 'bn',
  systemEn: 'en',
  userTemplateBn: null,
  userTemplateEn: null,
  status: AiPromptStatus.DRAFT,
  trafficPercent: 100,
  parentVersionId: null,
  variablesSchemaJson: null,
  testCasesJson: null,
  metadataJson: { promptKind: 'feature' },
  approvedByUserId: null,
  approvedAt: null,
  createdByUserId: null,
  updatedByUserId: null,
  deletedAt: null,
  deletedByUserId: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};

describe('prompt-management.util', () => {
  it('maps legacy runtime keys to AIMS keys', () => {
    expect(resolveAimsPromptKey('farmer_chat')).toBe('general_chat');
  });

  it('infers feature prompts from taskType', () => {
    expect(inferPromptKind({ taskType: 'GENERAL_CHAT' })).toBe('feature');
    expect(inferPromptKind({ taskType: null, metadataJson: { promptKind: 'system' } })).toBe('system');
  });
});

describe('AiPromptManagementService', () => {
  afterEach(resetPromptManagementForTests);

  it('creates a draft version without publishing', async () => {
    aiPromptFindFirst.mockResolvedValueOnce({ version: 1 });
    aiPromptCreate.mockResolvedValueOnce(draftRow);

    const service = new AiPromptManagementService();
    const created = await service.createDraft({
      promptKey: 'general_chat',
      name: 'General Chat',
      taskType: 'GENERAL_CHAT',
      kind: 'feature',
      systemBn: 'bn',
      systemEn: 'en',
    });

    expect(created.status).toBe('DRAFT');
    expect(created.published).toBe(false);
    expect(created.version).toBe(2);
    expect(aiPromptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AiPromptStatus.DRAFT,
          promptKey: 'general_chat',
        }),
      }),
    );
  });

  it('updates only draft prompts', async () => {
    aiPromptFindFirst.mockResolvedValueOnce(draftRow);
    aiPromptUpdate.mockResolvedValueOnce({ ...draftRow, name: 'Updated Chat' });

    const service = new AiPromptManagementService();
    const updated = await service.updateDraft('prompt-draft-1', { name: 'Updated Chat' });
    expect(updated.name).toBe('Updated Chat');
  });

  it('rejects editing published prompts', async () => {
    aiPromptFindFirst.mockResolvedValueOnce({ ...draftRow, status: AiPromptStatus.ACTIVE });
    const service = new AiPromptManagementService();
    await expect(service.updateDraft('prompt-draft-1', { name: 'Nope' })).rejects.toBeInstanceOf(
      PromptNotDraftError,
    );
  });

  it('publishes draft and archives previous active version', async () => {
    aiPromptFindFirst
      .mockResolvedValueOnce(draftRow)
      .mockResolvedValueOnce({ ...draftRow, status: AiPromptStatus.ACTIVE, approvedAt: new Date() });

    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        aiPrompt: {
          updateMany: aiPromptUpdateMany,
          update: aiPromptUpdate,
        },
      };
      await fn(tx);
    });

    const service = new AiPromptManagementService();
    const published = await service.publish('prompt-draft-1', { userId: 'admin-1' });

    expect(published.published).toBe(true);
    expect(aiPromptUpdateMany).toHaveBeenCalled();
    expect(aiPromptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prompt-draft-1' },
        data: expect.objectContaining({ status: AiPromptStatus.ACTIVE }),
      }),
    );
  });

  it('rolls back an archived version', async () => {
    const archived = { ...draftRow, id: 'archived-1', version: 1, status: AiPromptStatus.ARCHIVED };
    aiPromptFindFirst
      .mockResolvedValueOnce(archived)
      .mockResolvedValueOnce({ ...archived, status: AiPromptStatus.ACTIVE });

    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        aiPrompt: {
          updateMany: aiPromptUpdateMany,
          update: aiPromptUpdate,
        },
      };
      await fn(tx);
    });

    const service = new AiPromptManagementService();
    const rolledBack = await service.rollback('archived-1');
    expect(rolledBack.status).toBe('ACTIVE');
  });

  it('rejects rollback for non-archived versions', async () => {
    aiPromptFindFirst.mockResolvedValueOnce(draftRow);
    const service = new AiPromptManagementService();
    await expect(service.rollback('prompt-draft-1')).rejects.toBeInstanceOf(PromptRollbackError);
  });

  it('creates a new draft from published prompt for no-deploy editing', async () => {
    const published = { ...draftRow, id: 'pub-1', status: AiPromptStatus.ACTIVE, version: 1 };
    aiPromptFindFirst
      .mockResolvedValueOnce(published)
      .mockResolvedValueOnce({ version: 1 });
    aiPromptCreate.mockResolvedValueOnce({ ...draftRow, version: 2, status: AiPromptStatus.DRAFT });

    const service = new AiPromptManagementService();
    const draft = await service.createDraftFromPublished('general_chat');
    expect(draft.status).toBe('DRAFT');
    expect(draft.version).toBe(2);
  });

  it('resolves published prompt for runtime', async () => {
    aiPromptFindFirst.mockResolvedValueOnce({ ...draftRow, status: AiPromptStatus.ACTIVE, version: 1 });
    const service = new AiPromptManagementService();
    const resolved = await service.resolvePublished('farmer_chat');
    expect(resolved.key).toBe('farmer_chat');
    expect(resolved.promptKey).toBe('general_chat');
  });
});
