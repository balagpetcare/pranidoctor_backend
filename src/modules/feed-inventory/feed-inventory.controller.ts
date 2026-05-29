import type {
  CreateFeedInventoryBodyInput,
  FeedInventoryLowStockQueryInput,
  ListFeedInventoryQueryInput,
  RecordFeedPurchaseBodyInput,
  UpdateFeedInventoryBodyInput,
} from './feed-inventory.validator.js';
import { getFeedInventoryService } from './feed-inventory.service.js';

export class FeedInventoryController {
  private readonly inventory = getFeedInventoryService();

  listInventory(customerId: string, query: ListFeedInventoryQueryInput) {
    return this.inventory.listInventory(customerId, query);
  }

  getInventoryById(customerId: string, id: string) {
    return this.inventory.getInventoryById(customerId, id);
  }

  createInventory(
    customerId: string,
    body: CreateFeedInventoryBodyInput,
    actorUserId?: string,
  ) {
    return this.inventory.createInventory(customerId, body, actorUserId);
  }

  updateInventory(
    customerId: string,
    id: string,
    body: UpdateFeedInventoryBodyInput,
    actorUserId?: string,
  ) {
    return this.inventory.updateInventory(customerId, id, body, actorUserId);
  }

  recordPurchase(
    customerId: string,
    body: RecordFeedPurchaseBodyInput,
    actorUserId?: string,
  ) {
    return this.inventory.recordPurchase(customerId, body, actorUserId);
  }

  getLowStockAlerts(customerId: string, query: FeedInventoryLowStockQueryInput) {
    return this.inventory.getLowStockAlerts(customerId, query.farmRef);
  }
}

let controllerSingleton: FeedInventoryController | undefined;

export function getFeedInventoryController(): FeedInventoryController {
  if (!controllerSingleton) {
    controllerSingleton = new FeedInventoryController();
  }
  return controllerSingleton;
}
