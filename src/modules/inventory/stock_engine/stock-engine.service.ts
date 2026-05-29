import { Prisma } from '@/generated/prisma/client';
import {
  InventoryTransactionType,
} from '@/generated/prisma/client';

import { InventoryEventAction, type InventoryEventActionType } from '../inventory.events.js';
import { getInventoryRepository, type InventoryItemRow } from '../inventory.repository.js';
import {
  InventoryStockError,
  type StockOperationInput,
  type StockOperationResult,
} from './stock-engine.types.js';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function unitSnapshotForItem(item: InventoryItemRow): string {
  if (item.inventoryType === 'FEED') {
    return item.feedUnit ?? 'OTHER';
  }
  return item.medicineUnit ?? 'OTHER';
}

function isLowStock(item: InventoryItemRow, onHand: number): boolean {
  if (item.lowStockThreshold == null) return false;
  return onHand <= decimalToNumber(item.lowStockThreshold);
}

export class StockEngineService {
  constructor(private readonly repo = getInventoryRepository()) {}

  async executeOperation(input: StockOperationInput): Promise<StockOperationResult> {
    if (input.idempotencyKey) {
      const existing = await this.repo.findItemByIdempotency(
        input.customerId,
        input.idempotencyKey,
      );
      if (existing) {
        const onHand = decimalToNumber(existing.item.balance?.quantityOnHand ?? 0);
        const reserved = decimalToNumber(existing.item.balance?.quantityReserved ?? 0);
        return {
          transactionId: existing.id,
          quantityOnHand: onHand,
          quantityReserved: reserved,
          quantityAvailable: round3(onHand - reserved),
          isLowStock: isLowStock(existing.item, onHand),
        };
      }
    }

    const item = await this.repo.findItemById(input.customerId, input.inventoryItemId);
    if (!item) throw new InventoryStockError('ITEM_NOT_FOUND');
    if (!item.isActive || item.deletedAt) throw new InventoryStockError('ITEM_INACTIVE');
    if (item.inventoryType !== input.inventoryType) {
      throw new InventoryStockError('ITEM_TYPE_MISMATCH');
    }
    if (item.farmRef !== input.farmRef) throw new InventoryStockError('FARM_MISMATCH');

    const qty = round3(Math.abs(input.quantity));
    if (qty <= 0) throw new InventoryStockError('INVALID_QUANTITY');

    let onHand = decimalToNumber(item.balance?.quantityOnHand ?? 0);
    let reserved = decimalToNumber(item.balance?.quantityReserved ?? 0);
    let delta = 0;
    let auditAction: InventoryEventActionType = InventoryEventAction.STOCK_RECEIPT;

    switch (input.transactionType) {
      case InventoryTransactionType.RECEIPT:
        delta = qty;
        onHand = round3(onHand + qty);
        auditAction = InventoryEventAction.STOCK_RECEIPT;
        break;
      case InventoryTransactionType.ADJUSTMENT:
        delta = round3(input.quantity);
        onHand = round3(onHand + delta);
        auditAction = InventoryEventAction.STOCK_ADJUSTMENT;
        break;
      case InventoryTransactionType.RESERVE:
        if (round3(onHand - reserved) < qty) {
          throw new InventoryStockError('INSUFFICIENT_STOCK');
        }
        reserved = round3(reserved + qty);
        delta = 0;
        auditAction = InventoryEventAction.STOCK_RESERVED;
        break;
      case InventoryTransactionType.RELEASE_RESERVE:
        if (reserved < qty) throw new InventoryStockError('INSUFFICIENT_RESERVED');
        reserved = round3(reserved - qty);
        delta = 0;
        auditAction = InventoryEventAction.STOCK_RESERVE_RELEASED;
        break;
      case InventoryTransactionType.CONSUMPTION: {
        let remaining = qty;
        if (input.useReserved) {
          const fromReserved = Math.min(reserved, remaining);
          reserved = round3(reserved - fromReserved);
          remaining = round3(remaining - fromReserved);
        }
        if (remaining > 0) {
          onHand = round3(onHand - remaining);
        }
        delta = -qty;
        auditAction = InventoryEventAction.STOCK_CONSUMPTION;
        break;
      }
      default:
        throw new InventoryStockError('INVALID_QUANTITY', `Unsupported type ${input.transactionType}`);
    }

    if (onHand < 0 && !item.allowNegativeStock) {
      throw new InventoryStockError('INSUFFICIENT_STOCK');
    }

    const signedDelta =
      input.transactionType === InventoryTransactionType.ADJUSTMENT
        ? delta
        : input.transactionType === InventoryTransactionType.CONSUMPTION
          ? -qty
          : input.transactionType === InventoryTransactionType.RECEIPT
            ? qty
            : 0;

    const { movement } = await this.repo.applyStockMutation({
      customerId: input.customerId,
      item,
      transactionType: input.transactionType,
      quantityDelta: signedDelta,
      unitSnapshot: input.unitSnapshot || unitSnapshotForItem(item),
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: input.reason ?? null,
      authorizedBy: input.authorizedBy ?? null,
      nextOnHand: onHand,
      nextReserved: reserved,
      auditAction,
      auditPayload: { quantity: qty, farmRef: input.farmRef },
      actorUserId: input.actorUserId ?? null,
    });

    const low = isLowStock(item, onHand);
    if (low) {
      await this.repo.writeAuditLog({
        customerId: input.customerId,
        inventoryItemId: item.id,
        action: InventoryEventAction.LOW_STOCK_DETECTED,
        payload: { quantityOnHand: onHand },
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      });
    }

    return {
      transactionId: movement.id,
      quantityOnHand: onHand,
      quantityReserved: reserved,
      quantityAvailable: round3(onHand - reserved),
      isLowStock: low,
    };
  }
}

let engineSingleton: StockEngineService | undefined;

export function getStockEngineService(): StockEngineService {
  if (!engineSingleton) {
    engineSingleton = new StockEngineService();
  }
  return engineSingleton;
}
