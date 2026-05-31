import {
  VkKnowledgeDomain,
  VkVersionStatus,
  type BdFeedAvailability,
  type LivestockSpecies,
  type Prisma,
} from '../../../../generated/prisma/index.js';

export type FeedEntityListFilters = {
  search?: string;
  status?: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'DEPRECATED' | 'ALL' | string;
  bdAvailability?: BdFeedAvailability;
  species?: LivestockSpecies;
};

type FeedListEntityType = 'FEED_INGREDIENT' | 'TOXIC_FEED_ALERT';

/**
 * Builds Prisma where for feed VKL entities using the effective version
 * (draft when present, otherwise published) — filters run before pagination.
 */
export function buildFeedEntityListWhere(
  entityType: FeedListEntityType,
  filters: FeedEntityListFilters,
): Prisma.VkKnowledgeEntityWhereInput {
  const where: Prisma.VkKnowledgeEntityWhereInput = {
    domain: VkKnowledgeDomain.FEED,
    entityType,
  };

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { slug: { contains: q, mode: 'insensitive' } },
      {
        versions: {
          some: {
            OR: [
              { titleBn: { contains: q, mode: 'insensitive' } },
              { titleEn: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  const versionWhere = buildEffectiveVersionWhere(entityType, filters);
  if (versionWhere) {
    const existingAnd = where.AND
      ? Array.isArray(where.AND)
        ? where.AND
        : [where.AND]
      : [];
    where.AND = [...existingAnd, versionWhere];
  }

  return where;
}

function buildEffectiveVersionWhere(
  entityType: FeedListEntityType,
  filters: FeedEntityListFilters,
): Prisma.VkKnowledgeEntityWhereInput | undefined {
  const versionFilter: Prisma.VkKnowledgeVersionWhereInput = {};

  if (filters.status && filters.status !== 'ALL') {
    versionFilter.status = filters.status as VkVersionStatus;
  }

  if (entityType === 'FEED_INGREDIENT') {
    if (filters.bdAvailability) {
      versionFilter.feedIngredients = { some: { bdAvailability: filters.bdAvailability } };
    }
    if (filters.species) {
      versionFilter.species = { has: filters.species };
    }
  } else if (filters.species) {
    versionFilter.toxicFeedAlerts = {
      some: { speciesAffected: { has: filters.species } },
    };
  }

  if (Object.keys(versionFilter).length === 0) {
    return undefined;
  }

  return {
    OR: [
      { draftVersion: { is: versionFilter } },
      {
        currentDraftVersionId: null,
        publishedVersion: { is: versionFilter },
      },
    ],
  };
}
