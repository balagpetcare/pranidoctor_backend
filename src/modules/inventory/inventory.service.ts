import {
  FeedCategory,
  FeedType,
  InventoryTransactionSourceType,
  InventoryTransactionType,
  InventoryType,
  Prisma,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

function feedCategoryToFeedType(category: FeedCategory): FeedType {
  switch (category) {
    case FeedCategory.ROUGHAGE:
      return FeedType.STRAW;
    case FeedCategory.GREEN:
      return FeedType.GRASS;
    case FeedCategory.CONCENTRATE:
      return FeedType.CONCENTRATE;
    case FeedCategory.MINERAL:
      return FeedType.MINERAL;
    case FeedCategory.SILAGE:
      return FeedType.SILAGE;
    default:
      return FeedType.OTHER;
  }
}

import type {
  AddStockBatchResultDto,
  AddStockResultDto,
  ConsumeStockResultDto,
  InventoryListResponseDto,
  InventorySummaryDto,
} from './inventory.dto.js';
import { InventoryEventAction } from './inventory.events.js';
import { toInventoryItemDto, toInventoryTransactionDto, toLowStockAlertDto } from './inventory.mapper.js';
import { getInventoryRepository } from './inventory.repository.js';
import type { AddInventoryBody, ConsumeInventoryBody, InventoryListQuery } from './inventory.schemas.js';
import { getInventoryTransactionService } from './transactions/transaction.service.js';
import { getStockEngineService } from './stock_engine/stock-engine.service.js';
import { InventoryStockError } from './stock_engine/stock-engine.types.js';

export class InventoryService {
  constructor(
    private readonly repo = getInventoryRepository(),
    private readonly stockEngine = getStockEngineService(),
    private readonly txService = getInventoryTransactionService(),
  ) {}

  async getSummary(customerId: string, farmRef: string): Promise<InventorySummaryDto> {
    const items = await prisma.inventoryItem.findMany({
      where: { customerId, farmRef, deletedAt: null, isActive: true },
      include: { balance: true },
    });

    const feedItems = items.filter((i) => i.inventoryType === InventoryType.FEED);
    const medItems = items.filter((i) => i.inventoryType === InventoryType.MEDICINE);

    const countLow = (rows: typeof items) =>
      rows.filter((row) => {
        const dto = toInventoryItemDto(row);
        return dto.isLowStock;
      }).length;

    return {
      farmRef,
      feed: { activeItems: feedItems.length, lowStockCount: countLow(feedItems) },
      medicine: { activeItems: medItems.length, lowStockCount: countLow(medItems) },
    };
  }

  async listByType(
    customerId: string,
    inventoryType: InventoryType,
    query: InventoryListQuery,
  ): Promise<InventoryListResponseDto> {
    const { rows, total } = await this.repo.listItems({
      customerId,
      farmRef: query.farmRef,
      inventoryType,
      activeOnly: query.activeOnly ?? true,
      ...(query.search ? { search: query.search } : {}),
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const items = rows.map(toInventoryItemDto);
    const lowStockAlerts = items
      .map(toLowStockAlertDto)
      .filter((a): a is NonNullable<typeof a> => a != null);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
      lowStockAlerts,
    };
  }

  async addStock(
    customerId: string,
    body: AddInventoryBody,
    actorUserId?: string,
  ): Promise<AddStockResultDto | AddStockBatchResultDto> {
    if (
      body.operation === 'CREATE_ITEM' &&
      body.items &&
      body.items.length > 0
    ) {
      const created: AddStockBatchResultDto['items'] = [];
      for (const row of body.items) {
        const single: AddInventoryBody = {
          farmRef: body.farmRef,
          inventoryType: InventoryType.FEED,
          operation: 'CREATE_ITEM',
          feedCatalogId: row.feedId,
          ...(row.openingQuantity != null && row.openingQuantity > 0
            ? { quantity: row.openingQuantity }
            : {}),
          ...(row.lowStockLevel != null
            ? { lowStockThreshold: row.lowStockLevel }
            : {}),
          ...(body.notes != null ? { notes: body.notes } : {}),
          ...(body.idempotencyKey
            ? { idempotencyKey: `${body.idempotencyKey}-${row.feedId}` }
            : {}),
        };
        const result = await this.addStock(customerId, single, actorUserId);
        if ('count' in result) {
          throw new InventoryStockError('INVALID_QUANTITY', 'Unexpected nested batch');
        }
        created.push(result.item);
      }
      return { items: created, count: created.length };
    }

    if (body.operation === 'CREATE_ITEM') {
      const initialQty = body.quantity != null ? Math.max(0, body.quantity) : 0;
      let displayName = body.displayName?.trim() ?? '';
      let feedType = body.feedType;
      let feedUnit = body.feedUnit;
      let feedCatalogId: string | undefined = body.feedCatalogId;

      if (body.feedCatalogId && body.inventoryType === InventoryType.FEED) {
        const master = await prisma.feedCatalog.findFirst({
          where: { id: body.feedCatalogId, isActive: true },
        });
        if (!master) {
          throw new InventoryStockError('ITEM_NOT_FOUND', 'Feed catalog item not found');
        }
        feedCatalogId = master.id;
        if (!displayName) displayName = master.nameBn;
        feedType = feedType ?? feedCategoryToFeedType(master.category);
        feedUnit = feedUnit ?? master.defaultUnit;
      }

      try {
        const item = await this.repo.createItemWithBalance(
          {
            customer: { connect: { id: customerId } },
            farmRef: body.farmRef,
            inventoryType: body.inventoryType,
            displayName,
            ...(feedCatalogId ? { feedCatalog: { connect: { id: feedCatalogId } } } : {}),
            ...(feedType ? { feedType } : {}),
            ...(feedUnit ? { feedUnit } : {}),
            ...(body.medicineUnit ? { medicineUnit: body.medicineUnit } : {}),
            ...(body.lowStockThreshold != null
              ? { lowStockThreshold: new Prisma.Decimal(body.lowStockThreshold.toFixed(3)) }
              : {}),
            allowNegativeStock: body.allowNegativeStock ?? false,
            ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
          },
          0,
        );

        await this.repo.writeAuditLog({
          customerId,
          inventoryItemId: item.id,
          action: InventoryEventAction.ITEM_CREATED,
          payload: { displayName: item.displayName, initialQty },
          ...(actorUserId ? { actorUserId } : {}),
        });

        let transactionId: string | null = null;
        if (initialQty > 0) {
          const op = await this.stockEngine.executeOperation({
            customerId,
            inventoryItemId: item.id,
            farmRef: body.farmRef,
            inventoryType: body.inventoryType,
            transactionType: InventoryTransactionType.RECEIPT,
            quantity: initialQty,
            unitSnapshot: '',
            sourceType: InventoryTransactionSourceType.MANUAL,
            ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
            reason: body.reason ?? 'Opening balance',
            ...(actorUserId ? { actorUserId } : {}),
          });
          transactionId = op.transactionId;
        }

        const refreshed = await this.repo.findItemById(customerId, item.id);
        const movement = transactionId
          ? await prisma.inventoryTransaction.findUniqueOrThrow({ where: { id: transactionId } })
          : null;

        return {
          item: toInventoryItemDto(refreshed!),
          transaction: movement
            ? toInventoryTransactionDto(movement)
            : toInventoryTransactionDto({
                id: `noop-${item.id}`,
                inventoryItemId: item.id,
                farmRef: body.farmRef,
                inventoryType: body.inventoryType,
                transactionType: InventoryTransactionType.RECEIPT,
                quantityDelta: new Prisma.Decimal(0),
                unitSnapshot: body.feedUnit ?? body.medicineUnit ?? 'OTHER',
                sourceType: InventoryTransactionSourceType.MANUAL,
                sourceId: null,
                reason: 'Item created',
                recordedAt: new Date(),
                createdAt: new Date(),
              }),
        };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new InventoryStockError('DUPLICATE_IDEMPOTENCY', 'Item name already exists');
        }
        throw e;
      }
    }

    const item = await this.repo.findItemById(customerId, body.inventoryItemId!);
    if (!item) throw new InventoryStockError('ITEM_NOT_FOUND');
    if (item.inventoryType !== body.inventoryType) {
      throw new InventoryStockError('ITEM_TYPE_MISMATCH');
    }

    if (body.operation === 'SET_THRESHOLD') {
      const updated = await this.repo.updateItem(item.id, {
        lowStockThreshold:
          body.lowStockThreshold == null
            ? null
            : new Prisma.Decimal(body.lowStockThreshold.toFixed(3)),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });
      await this.repo.writeAuditLog({
        customerId,
        inventoryItemId: item.id,
        action: InventoryEventAction.ITEM_UPDATED,
        payload: { lowStockThreshold: body.lowStockThreshold },
        ...(actorUserId ? { actorUserId } : {}),
      });
      const movement = await prisma.inventoryTransaction.findFirst({
        where: { inventoryItemId: item.id },
        orderBy: { recordedAt: 'desc' },
      });
      return {
        item: toInventoryItemDto(updated),
        transaction: movement
          ? toInventoryTransactionDto(movement)
          : ({
              id: '',
              inventoryItemId: item.id,
              farmRef: item.farmRef,
              inventoryType: item.inventoryType,
              transactionType: InventoryTransactionType.ADJUSTMENT,
              quantityDelta: 0,
              unitSnapshot: '',
              sourceType: InventoryTransactionSourceType.MANUAL,
              sourceId: null,
              reason: 'Threshold update',
              recordedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            } as AddStockResultDto['transaction']),
      };
    }

    const txType =
      body.operation === 'RECEIPT'
        ? InventoryTransactionType.RECEIPT
        : body.operation === 'ADJUSTMENT'
          ? InventoryTransactionType.ADJUSTMENT
          : body.operation === 'RESERVE'
            ? InventoryTransactionType.RESERVE
            : InventoryTransactionType.RELEASE_RESERVE;

    const quantity =
      body.operation === 'ADJUSTMENT' ? body.quantity! : Math.abs(body.quantity!);

    const op = await this.stockEngine.executeOperation({
      customerId,
      inventoryItemId: item.id,
      farmRef: body.farmRef,
      inventoryType: body.inventoryType,
      transactionType: txType,
      quantity,
      unitSnapshot: '',
      sourceType: InventoryTransactionSourceType.MANUAL,
      ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
      ...(body.reason ? { reason: body.reason } : {}),
      ...(actorUserId ? { actorUserId } : {}),
    });

    const movement = await prisma.inventoryTransaction.findUniqueOrThrow({
      where: { id: op.transactionId },
    });
    const refreshed = await this.repo.findItemById(customerId, item.id);

    return {
      item: toInventoryItemDto(refreshed!),
      transaction: toInventoryTransactionDto(movement),
    };
  }

  async consumeStock(
    customerId: string,
    body: ConsumeInventoryBody,
    actorUserId?: string,
  ): Promise<ConsumeStockResultDto> {
    if (
      body.inventoryType === 'MEDICINE' &&
      body.sourceType === 'FARM_TREATMENT' &&
      body.sourceId
    ) {
      const treatment = await prisma.farmTreatment.findFirst({
        where: { id: body.sourceId, customerId },
      });
      if (!treatment) throw new InventoryStockError('ITEM_NOT_FOUND', 'Treatment not found');
    }

    await this.txService.consumeStock(customerId, body, actorUserId);

    const item = await this.repo.findItemById(customerId, body.inventoryItemId);
    const movement = body.idempotencyKey
      ? await prisma.inventoryTransaction.findFirst({
          where: { customerId, idempotencyKey: body.idempotencyKey },
        })
      : await prisma.inventoryTransaction.findFirst({
          where: { inventoryItemId: body.inventoryItemId },
          orderBy: { createdAt: 'desc' },
        });

    return {
      item: toInventoryItemDto(item!),
      transaction: toInventoryTransactionDto(movement!),
    };
  }

  /**
   * Called from feed logging when deductStock is enabled.
   */
  async consumeForFeedRecord(params: {
    customerId: string;
    farmRef: string;
    inventoryItemId: string;
    quantity: number;
    feedRecordId: string;
    idempotencyKey?: string;
  }) {
    return this.stockEngine.executeOperation({
      customerId: params.customerId,
      inventoryItemId: params.inventoryItemId,
      farmRef: params.farmRef,
      inventoryType: InventoryType.FEED,
      transactionType: InventoryTransactionType.CONSUMPTION,
      quantity: params.quantity,
      unitSnapshot: '',
      sourceType: InventoryTransactionSourceType.FEED_RECORD,
      sourceId: params.feedRecordId,
      idempotencyKey: params.idempotencyKey ?? `feed:${params.feedRecordId}`,
    });
  }
}

let serviceSingleton: InventoryService | undefined;

export function getInventoryService(): InventoryService {
  if (!serviceSingleton) {
    serviceSingleton = new InventoryService();
  }
  return serviceSingleton;
}

export { InventoryStockError };
