import { InventoryType } from '@/generated/prisma/client';

import type { InventoryListQuery } from '../inventory.schemas.js';
import { getInventoryService } from '../inventory.service.js';

export class FeedInventoryService {
  constructor(private readonly inventory = getInventoryService()) {}

  list(customerId: string, query: InventoryListQuery) {
    return this.inventory.listByType(customerId, InventoryType.FEED, query);
  }
}

let feedSingleton: FeedInventoryService | undefined;

export function getFeedInventoryService(): FeedInventoryService {
  if (!feedSingleton) {
    feedSingleton = new FeedInventoryService();
  }
  return feedSingleton;
}
