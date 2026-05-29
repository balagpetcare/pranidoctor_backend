import { InventoryTransactionType } from '@/generated/prisma/client';

import type { ConsumeInventoryBody } from '../inventory.schemas.js';
import { getStockEngineService } from '../stock_engine/stock-engine.service.js';
import { InventoryStockError } from '../stock_engine/stock-engine.types.js';

export class InventoryTransactionService {
  constructor(private readonly stockEngine = getStockEngineService()) {}

  async consumeStock(
    customerId: string,
    body: ConsumeInventoryBody,
    actorUserId?: string,
  ) {
    const result = await this.stockEngine.executeOperation({
      customerId,
      inventoryItemId: body.inventoryItemId,
      farmRef: body.farmRef,
      inventoryType: body.inventoryType,
      transactionType: InventoryTransactionType.CONSUMPTION,
      quantity: body.quantity,
      unitSnapshot: '',
      sourceType: body.sourceType,
      ...(body.sourceId ? { sourceId: body.sourceId } : {}),
      ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
      ...(body.reason ? { reason: body.reason } : {}),
      ...(body.authorizedBy ? { authorizedBy: body.authorizedBy } : {}),
      ...(actorUserId ? { actorUserId } : {}),
      useReserved: body.useReserved ?? body.inventoryType === 'MEDICINE',
    });

    return result;
  }
}

let txServiceSingleton: InventoryTransactionService | undefined;

export function getInventoryTransactionService(): InventoryTransactionService {
  if (!txServiceSingleton) {
    txServiceSingleton = new InventoryTransactionService();
  }
  return txServiceSingleton;
}

export { InventoryStockError };
