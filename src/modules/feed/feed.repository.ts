import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

import { toDecimal } from '../phase4-shared/decimal.js';
import type {
  CreateFeedItemBodyInput,
  ListFeedItemsQueryInput,
  UpdateFeedItemBodyInput,
} from './feed.validator.js';
import type { FeedItemRow, PaginatedFeedItems } from './types.js';

const feedItemInclude = {
  nutrition: true,
} as const;

function mapFeedItem(
  row: Prisma.FeedItemGetPayload<{ include: typeof feedItemInclude }>,
): FeedItemRow {
  return row;
}

function buildNutritionCreateData(input: NonNullable<CreateFeedItemBodyInput['nutrition']>) {
  return {
    cpPercent: toDecimal(input.cpPercent),
    tdnPercent: toDecimal(input.tdnPercent),
    cfPercent: toDecimal(input.cfPercent),
    eePercent: toDecimal(input.eePercent),
    caPercent: toDecimal(input.caPercent),
    pPercent: toDecimal(input.pPercent),
    dmPercent: toDecimal(input.dmPercent),
    source: input.source?.trim() ?? null,
  };
}

export class FeedRepository {
  async listFeedItems(query: ListFeedItemsQueryInput): Promise<PaginatedFeedItems> {
    const where: Prisma.FeedItemWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameBn: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const orderBy: Prisma.FeedItemOrderByWithRelationInput = {
      [query.sortBy]: query.sortOrder,
    };

    const [total, rows] = await Promise.all([
      prisma.feedItem.count({ where }),
      prisma.feedItem.findMany({
        where,
        include: feedItemInclude,
        orderBy,
        skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map(mapFeedItem),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    };
  }

  async findFeedItemById(id: string, options?: { activeOnly?: boolean }): Promise<FeedItemRow | null> {
    const row = await prisma.feedItem.findFirst({
      where: {
        id,
        ...(options?.activeOnly ? { isActive: true } : {}),
      },
      include: feedItemInclude,
    });
    return row ? mapFeedItem(row) : null;
  }

  async createFeedItem(input: CreateFeedItemBodyInput): Promise<FeedItemRow> {
    const data: Prisma.FeedItemCreateInput = {
      code: input.code.trim().toLowerCase(),
      category: input.category,
      nameBn: input.nameBn.trim(),
      nameEn: input.nameEn.trim(),
      defaultUnit: input.defaultUnit,
      approxPriceBdt: toDecimal(input.approxPriceBdt),
      isSeasonal: input.isSeasonal ?? false,
      seasonNotesBn: input.seasonNotesBn?.trim() ?? null,
      seasonNotesEn: input.seasonNotesEn?.trim() ?? null,
      isSeeded: input.isSeeded ?? false,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    };

    if (input.moistureType !== undefined) data.moistureType = input.moistureType;
    if (input.restrictionJson !== undefined) {
      data.restrictionJson =
        input.restrictionJson === null
          ? Prisma.JsonNull
          : (input.restrictionJson as Prisma.InputJsonValue);
    }
    if (input.suitabilityJson !== undefined) {
      data.suitabilityJson =
        input.suitabilityJson === null
          ? Prisma.JsonNull
          : (input.suitabilityJson as Prisma.InputJsonValue);
    }
    if (input.nutrition) {
      data.nutrition = { create: buildNutritionCreateData(input.nutrition) };
    }

    const row = await prisma.feedItem.create({
      data,
      include: feedItemInclude,
    });
    return mapFeedItem(row);
  }

  async updateFeedItem(id: string, input: UpdateFeedItemBodyInput): Promise<FeedItemRow | null> {
    const existing = await prisma.feedItem.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Prisma.FeedItemUpdateInput = {};
    if (input.category !== undefined) data.category = input.category;
    if (input.nameBn !== undefined) data.nameBn = input.nameBn.trim();
    if (input.nameEn !== undefined) data.nameEn = input.nameEn.trim();
    if (input.defaultUnit !== undefined) data.defaultUnit = input.defaultUnit;
    if (input.approxPriceBdt !== undefined) data.approxPriceBdt = toDecimal(input.approxPriceBdt);
    if (input.moistureType !== undefined) data.moistureType = input.moistureType;
    if (input.isSeasonal !== undefined) data.isSeasonal = input.isSeasonal;
    if (input.seasonNotesBn !== undefined) data.seasonNotesBn = input.seasonNotesBn?.trim() ?? null;
    if (input.seasonNotesEn !== undefined) data.seasonNotesEn = input.seasonNotesEn?.trim() ?? null;
    if (input.restrictionJson !== undefined) {
      data.restrictionJson =
        input.restrictionJson === null
          ? Prisma.JsonNull
          : (input.restrictionJson as Prisma.InputJsonValue);
    }
    if (input.suitabilityJson !== undefined) {
      data.suitabilityJson =
        input.suitabilityJson === null
          ? Prisma.JsonNull
          : (input.suitabilityJson as Prisma.InputJsonValue);
    }
    if (input.isSeeded !== undefined) data.isSeeded = input.isSeeded;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    if (input.nutrition === null) {
      data.nutrition = { delete: true };
    } else if (input.nutrition) {
      data.nutrition = {
        upsert: {
          create: buildNutritionCreateData(input.nutrition),
          update: buildNutritionCreateData(input.nutrition),
        },
      };
    }

    const row = await prisma.feedItem.update({
      where: { id },
      data,
      include: feedItemInclude,
    });
    return mapFeedItem(row);
  }

  async deactivateFeedItem(id: string): Promise<FeedItemRow | null> {
    const existing = await prisma.feedItem.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await prisma.feedItem.update({
      where: { id },
      data: { isActive: false },
      include: feedItemInclude,
    });
    return mapFeedItem(row);
  }
}

let repositorySingleton: FeedRepository | undefined;

export function getFeedRepository(): FeedRepository {
  if (!repositorySingleton) {
    repositorySingleton = new FeedRepository();
  }
  return repositorySingleton;
}
