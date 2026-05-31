import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VkVersionStatus } from '../../../../generated/prisma/index.js';

const mockPrisma = {
  vkKnowledgeEntity: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  vkKnowledgeVersion: {
    update: vi.fn(),
  },
  vkFeedIngredient: {
    update: vi.fn(),
  },
  vkToxicFeedAlert: {
    update: vi.fn(),
  },
  vkKnowledgeApproval: {
    create: vi.fn(),
  },
  vkKnowledgeAuditEvent: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => mockPrisma,
}));

const governanceMocks = {
  createFeedIngredientDraft: vi.fn(),
  createToxicFeedAlertDraft: vi.fn(),
  submitForReview: vi.fn(),
  approveAndPublish: vi.fn(),
  completeEditorialReview: vi.fn(),
  rejectVersion: vi.fn(),
};

vi.mock('../../feed-knowledge/feed-knowledge-governance.service.js', () => ({
  getFeedKnowledgeGovernanceService: () => governanceMocks,
}));

import {
  getFeedIngredientAdminService,
  resetFeedIngredientAdminServiceForTests,
} from './feed-ingredient-admin.service.js';
import {
  getFeedToxicAdminService,
  resetFeedToxicAdminServiceForTests,
} from './feed-toxic-admin.service.js';
import { feedAdminCan } from './feed-admin.permissions.js';
import type { AiAdminActor } from '../../admin/ai-admin.guard.js';

function actor(role: string): AiAdminActor {
  return { id: `user-${role}`, role };
}

describe('Feed Admin integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeedIngredientAdminServiceForTests();
    resetFeedToxicAdminServiceForTests();
    mockPrisma.vkKnowledgeAuditEvent.create.mockResolvedValue({ id: 'audit-1' });
  });

  describe('permission policy A (SUPPORT read-only)', () => {
    it('allows SUPPORT view and audit only', () => {
      expect(feedAdminCan(actor('SUPPORT'), 'ai.feed.view')).toBe(true);
      expect(feedAdminCan(actor('SUPPORT'), 'ai.feed.audit')).toBe(true);
      expect(feedAdminCan(actor('SUPPORT'), 'ai.feed.manage')).toBe(false);
      expect(feedAdminCan(actor('SUPPORT'), 'ai.feed.publish')).toBe(false);
    });

    it('allows ADMIN full feed capabilities', () => {
      expect(feedAdminCan(actor('ADMIN'), 'ai.feed.manage')).toBe(true);
      expect(feedAdminCan(actor('ADMIN'), 'ai.feed.publish')).toBe(true);
    });
  });

  describe('feed ingredient workflow', () => {
    const createBody = {
      ingredientCode: 'MAIZE-TEST',
      titleBn: 'ভুট্টা',
      titleEn: 'Maize',
      bodyBn: 'বিবরণ',
      bodyEn: 'Description',
      localNamesBn: ['ভুট্টা'],
      species: ['CATTLE' as const],
      composition: { dmPercent: 88, cpPercent: 9 },
      bdAvailability: 'WIDELY_AVAILABLE' as const,
    };

    it('creates draft and records audit', async () => {
      governanceMocks.createFeedIngredientDraft.mockResolvedValue({
        entityId: 'ent-1',
        versionId: 'ver-1',
      });

      const result = await getFeedIngredientAdminService().create(createBody, 'admin-1');

      expect(result).toEqual({ entityId: 'ent-1', versionId: 'ver-1' });
      expect(governanceMocks.createFeedIngredientDraft).toHaveBeenCalled();
      expect(mockPrisma.vkKnowledgeAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'FEED_INGREDIENT_CREATED' }),
        }),
      );
    });

    it('runs draft → review → publish', async () => {
      await getFeedIngredientAdminService().submitForReview('ent-1', 'admin-1', 'ready');
      await getFeedIngredientAdminService().publish('ent-1', 'admin-1', 'ok');

      expect(governanceMocks.submitForReview).toHaveBeenCalledWith('ent-1', 'admin-1', 'ready');
      expect(governanceMocks.approveAndPublish).toHaveBeenCalledWith('ent-1', 'admin-1', 'ok');
      expect(mockPrisma.vkKnowledgeAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'FEED_INGREDIENT_PUBLISHED' }),
        }),
      );
    });

    it('lists with prisma count matching filtered where', async () => {
      mockPrisma.vkKnowledgeEntity.findMany.mockResolvedValue([
        {
          id: 'ent-1',
          slug: 'feed-ingredient-maize-test',
          updatedAt: new Date(),
          draftVersion: {
            id: 'ver-1',
            versionNumber: 1,
            status: VkVersionStatus.DRAFT,
            titleBn: 'ভুট্টা',
            titleEn: 'Maize',
            publishedAt: null,
            feedIngredients: [
              {
                ingredientCode: 'MAIZE-TEST',
                bdAvailability: 'WIDELY_AVAILABLE',
              },
            ],
          },
          publishedVersion: null,
        },
      ]);
      mockPrisma.vkKnowledgeEntity.count.mockResolvedValue(1);

      const result = await getFeedIngredientAdminService().list({
        status: 'DRAFT',
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(mockPrisma.vkKnowledgeEntity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 0,
          where: expect.objectContaining({
            entityType: 'FEED_INGREDIENT',
            AND: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('toxic alert workflow', () => {
    const toxicBody = {
      substance: 'Aflatoxin',
      titleBn: 'আফলাটক্সিন',
      titleEn: 'Aflatoxin',
      bodyBn: 'বিবরণ',
      bodyEn: 'Description',
      commonNamesBn: ['ছত্রাক'],
      speciesAffected: ['CATTLE' as const],
      species: ['CATTLE' as const],
      toxicThreshold: '20 ppb',
      clinicalSignsBn: ['জন্ডিস'],
      immediateActionBn: 'ভেটেরিনারি',
      immediateActionEn: 'Call vet',
    };

    it('creates toxic draft with audit', async () => {
      governanceMocks.createToxicFeedAlertDraft.mockResolvedValue({
        entityId: 'tox-1',
        versionId: 'tox-ver-1',
      });

      await getFeedToxicAdminService().create(toxicBody, 'admin-1');

      expect(governanceMocks.createToxicFeedAlertDraft).toHaveBeenCalled();
      expect(mockPrisma.vkKnowledgeAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'TOXIC_ALERT_CREATED' }),
        }),
      );
    });

    it('runs draft → review → publish with audit trail', async () => {
      mockPrisma.vkKnowledgeEntity.findUnique.mockResolvedValue({
        id: 'tox-1',
        draftVersion: { id: 'tox-ver-1', status: VkVersionStatus.VET_APPROVAL },
      });

      await getFeedToxicAdminService().submitForReview('tox-1', 'admin-1');
      await getFeedToxicAdminService().review('tox-1', 'admin-1', true, 'ok');
      await getFeedToxicAdminService().approve('tox-1', 'vet-1', 'vet ok');
      await getFeedToxicAdminService().publish('tox-1', 'vet-1');

      expect(governanceMocks.submitForReview).toHaveBeenCalled();
      expect(governanceMocks.completeEditorialReview).toHaveBeenCalledWith(
        'tox-1',
        'admin-1',
        true,
        'ok',
      );
      expect(mockPrisma.vkKnowledgeApproval.create).toHaveBeenCalled();
      expect(governanceMocks.approveAndPublish).toHaveBeenCalled();
      expect(mockPrisma.vkKnowledgeAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'TOXIC_ALERT_PUBLISHED' }),
        }),
      );
    });
  });
});
