import type { Prisma } from '@/generated/prisma/client';
import {
  InventoryTransactionSourceType,
  InventoryTransactionType,
  InventoryType,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

import type { InventoryEventActionType } from './inventory.events.js';

const itemInclude = {
  balance: true,
} as const;

export type InventoryItemRow = Prisma.InventoryItemGetPayload<{
  include: typeof itemInclude;
}>;

export class InventoryRepository {
  async findItemById(
    customerId: string,
    itemId: string,
  ): Promise<InventoryItemRow | null> {
    return prisma.inventoryItem.findFirst({
      where: { id: itemId, customerId, deletedAt: null },
      include: itemInclude,
    });
  }

  async findItemByIdempotency(
    customerId: string,
    idempotencyKey: string,
  ) {
    return prisma.inventoryTransaction.findFirst({
      where: { customerId, idempotencyKey },
      include: { item: { include: itemInclude } },
    });
  }

  async listItems(params: {
    customerId: string;
    farmRef: string;
    inventoryType: InventoryType;
    activeOnly: boolean;
    search?: string;
    skip: number;
    take: number;
  }): Promise<{ rows: InventoryItemRow[]; total: number }> {
    const where: Prisma.InventoryItemWhereInput = {
      customerId: params.customerId,
      farmRef: params.farmRef,
      inventoryType: params.inventoryType,
      deletedAt: null,
      ...(params.activeOnly ? { isActive: true } : {}),
      ...(params.search
        ? { displayName: { contains: params.search, mode: 'insensitive' } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({
        where,
        include: itemInclude,
        orderBy: [{ displayName: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return { rows, total };
  }

  async createItemWithBalance(
    data: Prisma.InventoryItemCreateInput,
    initialQuantity: number,
  ): Promise<InventoryItemRow> {
    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data,
        include: itemInclude,
      });
      await tx.inventoryBalance.create({
        data: {
          inventoryItemId: item.id,
          quantityOnHand: initialQuantity,
          quantityReserved: 0,
        },
      });
      return tx.inventoryItem.findUniqueOrThrow({
        where: { id: item.id },
        include: itemInclude,
      });
    });
  }

  async updateItem(
    itemId: string,
    data: Prisma.InventoryItemUpdateInput,
  ): Promise<InventoryItemRow> {
    return prisma.inventoryItem.update({
      where: { id: itemId },
      data,
      include: itemInclude,
    });
  }

  async softDeleteItem(itemId: string): Promise<InventoryItemRow> {
    return prisma.inventoryItem.update({
      where: { id: itemId },
      data: { isActive: false, deletedAt: new Date() },
      include: itemInclude,
    });
  }

  async writeAuditLog(params: {
    customerId: string;
    inventoryItemId?: string;
    action: InventoryEventActionType;
    payload?: Record<string, unknown>;
    actorUserId?: string;
  }) {
    await prisma.inventoryAuditLog.create({
      data: {
        customerId: params.customerId,
        inventoryItemId: params.inventoryItemId ?? null,
        action: params.action,
        ...(params.payload
          ? { payload: params.payload as Prisma.InputJsonValue }
          : {}),
        actorUserId: params.actorUserId ?? null,
      },
    });
  }

  async applyStockMutation(params: {
    customerId: string;
    item: InventoryItemRow;
    transactionType: InventoryTransactionType;
    quantityDelta: number;
    unitSnapshot: string;
    sourceType: InventoryTransactionSourceType;
    sourceId: string | null;
    idempotencyKey: string | null;
    reason: string | null;
    authorizedBy: string | null;
    nextOnHand: number;
    nextReserved: number;
    auditAction: InventoryEventActionType;
    auditPayload?: Record<string, unknown>;
    actorUserId: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryTransaction.create({
        data: {
          customerId: params.customerId,
          inventoryItemId: params.item.id,
          farmRef: params.item.farmRef,
          inventoryType: params.item.inventoryType,
          transactionType: params.transactionType,
          quantityDelta: params.quantityDelta,
          unitSnapshot: params.unitSnapshot,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          idempotencyKey: params.idempotencyKey,
          reason: params.reason,
          authorizedBy: params.authorizedBy,
        },
      });

      await tx.inventoryBalance.update({
        where: { inventoryItemId: params.item.id },
        data: {
          quantityOnHand: params.nextOnHand,
          quantityReserved: params.nextReserved,
        },
      });

      await tx.inventoryAuditLog.create({
        data: {
          customerId: params.customerId,
          inventoryItemId: params.item.id,
          action: params.auditAction,
          payload: {
            transactionId: movement.id,
            ...params.auditPayload,
          },
          actorUserId: params.actorUserId,
        },
      });

      const updated = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: params.item.id },
        include: itemInclude,
      });

      return { movement, item: updated };
    });
  }
}

let repositorySingleton: InventoryRepository | undefined;

export function getInventoryRepository(): InventoryRepository {
  if (!repositorySingleton) {
    repositorySingleton = new InventoryRepository();
  }
  return repositorySingleton;
}
