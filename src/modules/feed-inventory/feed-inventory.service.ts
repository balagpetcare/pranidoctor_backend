import { Prisma } from '@/generated/prisma/client';

import { writeLivestockAudit } from '../phase4-shared/audit.js';
import {
  assertFeedInventoryOwned,
  assertFeedItemExists,
  OwnershipError,
} from '../phase4-shared/ownership.js';
import { FEED_INVENTORY_ENTITY_TYPE } from './constants.js';
import type {
  FeedInventoryListResponseDto,
  FeedInventoryLowStockAlertDto,
  FeedInventoryItemDto,
  RecordFeedPurchaseResponseDto,
} from './feed-inventory.dto.js';
import {
  toFeedInventoryItemDto,
  toFeedInventoryListResponseDto,
  toFeedPurchaseDto,
  toLowStockAlertDto,
} from './feed-inventory.dto.js';
import { getFeedInventoryRepository } from './feed-inventory.repository.js';
import type {
  CreateFeedInventoryBodyInput,
  ListFeedInventoryQueryInput,
  RecordFeedPurchaseBodyInput,
  UpdateFeedInventoryBodyInput,
} from './feed-inventory.validator.js';
import type { RecordFeedPurchaseInput } from './types.js';

export class FeedInventoryError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'INACTIVE'
      | 'DUPLICATE_NAME'
      | 'FEED_ITEM_NOT_FOUND'
      | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'FeedInventoryError';
  }
}

export class FeedInventoryService {
  constructor(private readonly repo = getFeedInventoryRepository()) {}

  async listInventory(
    customerId: string,
    query: ListFeedInventoryQueryInput,
  ): Promise<FeedInventoryListResponseDto> {
    const result = await this.repo.listInventory(customerId, query);
    return toFeedInventoryListResponseDto(result);
  }

  async getInventoryById(customerId: string, id: string): Promise<FeedInventoryItemDto> {
    const row = await this.repo.findInventoryById(customerId, id);
    if (!row) {
      throw new FeedInventoryError('NOT_FOUND', 'Feed inventory not found');
    }
    return toFeedInventoryItemDto(row);
  }

  async createInventory(
    customerId: string,
    body: CreateFeedInventoryBodyInput,
    actorUserId?: string,
  ): Promise<FeedInventoryItemDto> {
    let displayName = body.displayName.trim();
    let unit = body.unit;
    let feedItemId = body.feedItemId ?? null;

    if (feedItemId) {
      const master = await assertFeedItemExists(feedItemId);
      if (!displayName) displayName = master.nameBn;
      unit = unit ?? master.defaultUnit;
    }

    try {
      const row = await this.repo.createInventory(customerId, {
        ...body,
        displayName,
        unit,
        feedItemId,
      });

      await writeLivestockAudit(
        customerId,
        'FEED_INVENTORY_UPDATED',
        FEED_INVENTORY_ENTITY_TYPE,
        row.id,
        actorUserId,
        { action: 'CREATE', farmRef: row.farmRef, displayName: row.displayName },
      );

      return toFeedInventoryItemDto(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new FeedInventoryError('DUPLICATE_NAME', 'Feed inventory name already exists for this farm');
      }
      if (e instanceof OwnershipError) {
        throw new FeedInventoryError('FEED_ITEM_NOT_FOUND', e.message);
      }
      throw e;
    }
  }

  async updateInventory(
    customerId: string,
    id: string,
    body: UpdateFeedInventoryBodyInput,
    actorUserId?: string,
  ): Promise<FeedInventoryItemDto> {
    await assertFeedInventoryOwned(customerId, id);

    if (body.feedItemId) {
      await assertFeedItemExists(body.feedItemId);
    }

    try {
      const row = await this.repo.updateInventory(customerId, id, body);
      if (!row) {
        throw new FeedInventoryError('NOT_FOUND', 'Feed inventory not found');
      }

      await writeLivestockAudit(
        customerId,
        'FEED_INVENTORY_UPDATED',
        FEED_INVENTORY_ENTITY_TYPE,
        row.id,
        actorUserId,
        { action: 'UPDATE', changes: Object.keys(body) },
      );

      return toFeedInventoryItemDto(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new FeedInventoryError('DUPLICATE_NAME', 'Feed inventory name already exists for this farm');
      }
      if (e instanceof OwnershipError) {
        throw new FeedInventoryError(
          e.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'VALIDATION_ERROR',
          e.message,
        );
      }
      throw e;
    }
  }

  async recordPurchase(
    customerId: string,
    body: RecordFeedPurchaseBodyInput,
    actorUserId?: string,
  ): Promise<RecordFeedPurchaseResponseDto> {
    await assertFeedInventoryOwned(customerId, body.feedInventoryId);

    if (body.feedItemId) {
      await assertFeedItemExists(body.feedItemId);
    }

    try {
      const purchaseInput: RecordFeedPurchaseInput = {
        farmRef: body.farmRef,
        feedInventoryId: body.feedInventoryId,
        quantity: body.quantity,
        unit: body.unit,
        purchasedAt: new Date(`${body.purchasedAt}T00:00:00.000Z`),
      };
      if (body.feedItemId != null) purchaseInput.feedItemId = body.feedItemId;
      if (body.unitCostBdt != null) purchaseInput.unitCostBdt = body.unitCostBdt;
      if (body.totalCostBdt != null) purchaseInput.totalCostBdt = body.totalCostBdt;
      if (body.supplierName != null) purchaseInput.supplierName = body.supplierName;
      if (body.supplierPhone != null) purchaseInput.supplierPhone = body.supplierPhone;
      if (body.notes != null) purchaseInput.notes = body.notes;

      const result = await this.repo.recordPurchase(customerId, purchaseInput);

      await writeLivestockAudit(
        customerId,
        'FEED_INVENTORY_UPDATED',
        FEED_INVENTORY_ENTITY_TYPE,
        result.inventory.id,
        actorUserId,
        {
          action: 'PURCHASE',
          purchaseId: result.purchase.id,
          quantity: Number(result.purchase.quantity),
          unit: result.purchase.unit,
        },
      );

      return {
        purchase: toFeedPurchaseDto(result.purchase),
        inventory: toFeedInventoryItemDto(result.inventory),
      };
    } catch (e) {
      if (e instanceof Error && e.message === 'FEED_INVENTORY_NOT_FOUND') {
        throw new FeedInventoryError('NOT_FOUND', 'Feed inventory not found');
      }
      if (e instanceof Error && e.message === 'FEED_INVENTORY_INACTIVE') {
        throw new FeedInventoryError('INACTIVE', 'Feed inventory is not active');
      }
      if (e instanceof OwnershipError) {
        throw new FeedInventoryError('FEED_ITEM_NOT_FOUND', e.message);
      }
      throw e;
    }
  }

  async getLowStockAlerts(
    customerId: string,
    farmRef: string,
  ): Promise<FeedInventoryLowStockAlertDto[]> {
    const rows = await this.repo.listLowStock(customerId, farmRef);
    return rows
      .map(toLowStockAlertDto)
      .filter((alert): alert is FeedInventoryLowStockAlertDto => alert != null);
  }
}

let serviceSingleton: FeedInventoryService | undefined;

export function getFeedInventoryService(): FeedInventoryService {
  if (!serviceSingleton) {
    serviceSingleton = new FeedInventoryService();
  }
  return serviceSingleton;
}

export function mapFeedInventoryError(
  e: unknown,
): { code: string; status: number; message: string } | null {
  if (e instanceof FeedInventoryError) {
    switch (e.code) {
      case 'NOT_FOUND':
        return { code: 'FEED_INVENTORY_NOT_FOUND', status: 404, message: e.message };
      case 'INACTIVE':
        return { code: 'FEED_INVENTORY_INACTIVE', status: 410, message: e.message };
      case 'DUPLICATE_NAME':
        return { code: 'FEED_INVENTORY_DUPLICATE', status: 409, message: e.message };
      case 'FEED_ITEM_NOT_FOUND':
        return { code: 'FEED_ITEM_NOT_FOUND', status: 404, message: e.message };
      default:
        return { code: e.code, status: 400, message: e.message };
    }
  }
  if (e instanceof OwnershipError) {
    return {
      code: e.code === 'NOT_FOUND' ? 'FEED_INVENTORY_NOT_FOUND' : 'FORBIDDEN',
      status: e.code === 'NOT_FOUND' ? 404 : 403,
      message: e.message,
    };
  }
  return null;
}
