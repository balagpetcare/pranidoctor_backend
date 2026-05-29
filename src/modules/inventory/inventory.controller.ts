import type {
  AddInventoryBody,
  ConsumeInventoryBody,
  InventoryListQuery,
  InventorySummaryQuery,
} from './inventory.schemas.js';
import { getFeedInventoryService } from './feed/feed-inventory.service.js';
import { getMedicineInventoryService } from './medicine/medicine-inventory.service.js';
import { getInventoryService, InventoryStockError } from './inventory.service.js';

export class InventoryController {
  private readonly inventory = getInventoryService();
  private readonly feed = getFeedInventoryService();
  private readonly medicine = getMedicineInventoryService();

  getSummary(customerId: string, query: InventorySummaryQuery) {
    return this.inventory.getSummary(customerId, query.farmRef);
  }

  listFeed(customerId: string, query: InventoryListQuery) {
    return this.feed.list(customerId, query);
  }

  listMedicine(customerId: string, query: InventoryListQuery) {
    return this.medicine.list(customerId, query);
  }

  addStock(customerId: string, body: AddInventoryBody, actorUserId?: string) {
    return this.inventory.addStock(customerId, body, actorUserId);
  }

  consumeStock(customerId: string, body: ConsumeInventoryBody, actorUserId?: string) {
    return this.inventory.consumeStock(customerId, body, actorUserId);
  }
}

let controllerSingleton: InventoryController | undefined;

export function getInventoryController(): InventoryController {
  if (!controllerSingleton) {
    controllerSingleton = new InventoryController();
  }
  return controllerSingleton;
}

export function mapInventoryError(e: unknown): { code: string; status: number; message: string } | null {
  if (!(e instanceof InventoryStockError)) return null;
  switch (e.code) {
    case 'ITEM_NOT_FOUND':
      return { code: 'INVENTORY_ITEM_NOT_FOUND', status: 404, message: e.message };
    case 'INSUFFICIENT_STOCK':
      return { code: 'INSUFFICIENT_STOCK', status: 409, message: 'Insufficient stock for this operation' };
    case 'INSUFFICIENT_RESERVED':
      return { code: 'INSUFFICIENT_RESERVED', status: 409, message: 'Insufficient reserved quantity' };
    case 'ITEM_TYPE_MISMATCH':
    case 'FARM_MISMATCH':
      return { code: 'INVENTORY_ITEM_MISMATCH', status: 400, message: e.message };
    case 'ITEM_INACTIVE':
      return { code: 'INVENTORY_ITEM_INACTIVE', status: 410, message: 'Inventory item is not active' };
    case 'DUPLICATE_IDEMPOTENCY':
      return { code: 'DUPLICATE_ITEM', status: 409, message: e.message };
    default:
      return { code: e.code, status: 400, message: e.message };
  }
}
