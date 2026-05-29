import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

import { toDecimal } from '../phase4-shared/decimal.js';
import type {
  CreateFeedInventoryBodyInput,
  ListFeedInventoryQueryInput,
  UpdateFeedInventoryBodyInput,
} from './feed-inventory.validator.js';
import type {
  FeedInventoryRow,
  PaginatedFeedInventory,
  RecordFeedPurchaseInput,
  RecordFeedPurchaseResult,
} from './types.js';

const inventoryInclude = {
  feedItem: {
    select: {
      id: true,
      code: true,
      nameBn: true,
      nameEn: true,
      category: true,
      defaultUnit: true,
    },
  },
} as const;

function mapInventory(
  row: Prisma.FeedInventoryGetPayload<{ include: typeof inventoryInclude }>,
): FeedInventoryRow {
  return row;
}

export class FeedInventoryRepository {
  async listInventory(
    customerId: string,
    query: ListFeedInventoryQueryInput,
  ): Promise<PaginatedFeedInventory> {
    const where: Prisma.FeedInventoryWhereInput = {
      customerId,
      farmRef: query.farmRef,
      deletedAt: null,
      isActive: true,
      ...(query.search?.trim()
        ? { displayName: { contains: query.search.trim(), mode: 'insensitive' } }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      prisma.feedInventory.count({ where }),
      prisma.feedInventory.findMany({
        where,
        include: inventoryInclude,
        orderBy: [{ displayName: 'asc' }],
        skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map(mapInventory),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    };
  }

  async findInventoryById(customerId: string, id: string): Promise<FeedInventoryRow | null> {
    const row = await prisma.feedInventory.findFirst({
      where: { id, customerId, deletedAt: null },
      include: inventoryInclude,
    });
    return row ? mapInventory(row) : null;
  }

  async createInventory(
    customerId: string,
    input: CreateFeedInventoryBodyInput,
  ): Promise<FeedInventoryRow> {
    const row = await prisma.feedInventory.create({
      data: {
        customerId,
        farmRef: input.farmRef,
        deploymentBranch: input.deploymentBranch?.trim() ?? null,
        feedItemId: input.feedItemId ?? null,
        displayName: input.displayName.trim(),
        unit: input.unit ?? 'KG',
        quantityOnHand: toDecimal(input.quantityOnHand ?? 0) ?? new Prisma.Decimal(0),
        lowStockThreshold: toDecimal(input.lowStockThreshold),
        defaultBagWeightKg: toDecimal(input.defaultBagWeightKg),
        allowNegativeStock: input.allowNegativeStock ?? false,
        notes: input.notes?.trim() ?? null,
      },
      include: inventoryInclude,
    });
    return mapInventory(row);
  }

  async updateInventory(
    customerId: string,
    id: string,
    input: UpdateFeedInventoryBodyInput,
  ): Promise<FeedInventoryRow | null> {
    const existing = await prisma.feedInventory.findFirst({
      where: { id, customerId, deletedAt: null },
    });
    if (!existing) return null;

    const data: Prisma.FeedInventoryUpdateInput = {};
    if (input.deploymentBranch !== undefined) {
      data.deploymentBranch = input.deploymentBranch?.trim() ?? null;
    }
    if (input.displayName !== undefined) data.displayName = input.displayName.trim();
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.lowStockThreshold !== undefined) {
      data.lowStockThreshold = toDecimal(input.lowStockThreshold);
    }
    if (input.defaultBagWeightKg !== undefined) {
      data.defaultBagWeightKg = toDecimal(input.defaultBagWeightKg);
    }
    if (input.allowNegativeStock !== undefined) data.allowNegativeStock = input.allowNegativeStock;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;
    if (input.feedItemId !== undefined) {
      data.feedItem =
        input.feedItemId == null
          ? { disconnect: true }
          : { connect: { id: input.feedItemId } };
    }

    const row = await prisma.feedInventory.update({
      where: { id },
      data,
      include: inventoryInclude,
    });
    return mapInventory(row);
  }

  async listLowStock(customerId: string, farmRef: string): Promise<FeedInventoryRow[]> {
    const rows = await prisma.feedInventory.findMany({
      where: {
        customerId,
        farmRef,
        deletedAt: null,
        isActive: true,
        lowStockThreshold: { not: null },
      },
      include: inventoryInclude,
      orderBy: [{ displayName: 'asc' }],
    });

    return rows.filter((row) => {
      const threshold = row.lowStockThreshold;
      if (!threshold) return false;
      return row.quantityOnHand.lte(threshold);
    }).map(mapInventory);
  }

  async recordPurchase(
    customerId: string,
    input: RecordFeedPurchaseInput,
  ): Promise<RecordFeedPurchaseResult> {
    return prisma.$transaction(async (tx) => {
      const inventory = await tx.feedInventory.findFirst({
        where: {
          id: input.feedInventoryId,
          customerId,
          farmRef: input.farmRef,
          deletedAt: null,
        },
        include: inventoryInclude,
      });
      if (!inventory) {
        throw new Error('FEED_INVENTORY_NOT_FOUND');
      }
      if (!inventory.isActive) {
        throw new Error('FEED_INVENTORY_INACTIVE');
      }

      const quantity = new Prisma.Decimal(input.quantity.toFixed(3));
      let totalCost = toDecimal(input.totalCostBdt);
      const unitCost = toDecimal(input.unitCostBdt);
      if (totalCost == null && unitCost != null) {
        totalCost = unitCost.mul(quantity);
      }

      const purchase = await tx.feedPurchase.create({
        data: {
          customerId,
          farmRef: input.farmRef,
          feedInventoryId: input.feedInventoryId,
          feedItemId: input.feedItemId ?? inventory.feedItemId ?? null,
          quantity,
          unit: input.unit,
          unitCostBdt: unitCost,
          totalCostBdt: totalCost,
          supplierName: input.supplierName?.trim() ?? null,
          supplierPhone: input.supplierPhone?.trim() ?? null,
          purchasedAt: input.purchasedAt,
          notes: input.notes?.trim() ?? null,
        },
      });

      const updatedInventory = await tx.feedInventory.update({
        where: { id: inventory.id },
        data: {
          quantityOnHand: inventory.quantityOnHand.add(quantity),
        },
        include: inventoryInclude,
      });

      return {
        purchase,
        inventory: mapInventory(updatedInventory),
      };
    });
  }
}

let repositorySingleton: FeedInventoryRepository | undefined;

export function getFeedInventoryRepository(): FeedInventoryRepository {
  if (!repositorySingleton) {
    repositorySingleton = new FeedInventoryRepository();
  }
  return repositorySingleton;
}
