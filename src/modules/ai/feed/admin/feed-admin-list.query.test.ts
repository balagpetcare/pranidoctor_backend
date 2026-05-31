import { describe, expect, it } from 'vitest';
import { VkKnowledgeDomain, VkVersionStatus } from '../../../../generated/prisma/index.js';
import { buildFeedEntityListWhere } from './feed-admin-list.query.js';

describe('buildFeedEntityListWhere', () => {
  it('scopes to FEED domain and entity type', () => {
    const where = buildFeedEntityListWhere('FEED_INGREDIENT', {});
    expect(where.domain).toBe(VkKnowledgeDomain.FEED);
    expect(where.entityType).toBe('FEED_INGREDIENT');
  });

  it('applies status filter on effective version before pagination semantics', () => {
    const where = buildFeedEntityListWhere('FEED_INGREDIENT', { status: 'PUBLISHED' });
    const and = Array.isArray(where.AND) ? where.AND : [where.AND];
    expect(and.length).toBeGreaterThan(0);
    const branch = and.find(
      (clause) =>
        typeof clause === 'object' &&
        clause !== null &&
        'OR' in clause &&
        Array.isArray((clause as { OR: unknown[] }).OR),
    ) as { OR: Array<Record<string, unknown>> } | undefined;
    expect(branch?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          draftVersion: { is: expect.objectContaining({ status: VkVersionStatus.PUBLISHED }) },
        }),
        expect.objectContaining({
          currentDraftVersionId: null,
          publishedVersion: {
            is: expect.objectContaining({ status: VkVersionStatus.PUBLISHED }),
          },
        }),
      ]),
    );
  });

  it('combines bdAvailability and species on ingredient effective version', () => {
    const where = buildFeedEntityListWhere('FEED_INGREDIENT', {
      status: 'DRAFT',
      bdAvailability: 'WIDELY_AVAILABLE',
      species: 'CATTLE',
    });
    const and = Array.isArray(where.AND) ? where.AND : [where.AND];
    const branch = and[0] as { OR: Array<{ draftVersion?: { is: Record<string, unknown> } }> };
    const draftIs = branch.OR[0]?.draftVersion?.is;
    expect(draftIs?.status).toBe(VkVersionStatus.DRAFT);
    expect(draftIs?.feedIngredients).toEqual({
      some: { bdAvailability: 'WIDELY_AVAILABLE' },
    });
    expect(draftIs?.species).toEqual({ has: 'CATTLE' });
  });

  it('filters toxic alerts by speciesAffected on effective version', () => {
    const where = buildFeedEntityListWhere('TOXIC_FEED_ALERT', {
      status: 'IN_REVIEW',
      species: 'GOAT',
    });
    const and = Array.isArray(where.AND) ? where.AND : [where.AND];
    const branch = and[0] as { OR: Array<{ draftVersion?: { is: Record<string, unknown> } }> };
    expect(branch.OR[0]?.draftVersion?.is?.toxicFeedAlerts).toEqual({
      some: { speciesAffected: { has: 'GOAT' } },
    });
  });
});
