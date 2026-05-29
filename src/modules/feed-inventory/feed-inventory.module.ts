import { FeedInventoryController } from './feed-inventory.controller.js';
import { FeedInventoryRepository } from './feed-inventory.repository.js';
import { FeedInventoryService } from './feed-inventory.service.js';

export class FeedInventoryModule {
  readonly repository: FeedInventoryRepository;
  readonly service: FeedInventoryService;
  readonly controller: FeedInventoryController;

  constructor() {
    this.repository = new FeedInventoryRepository();
    this.service = new FeedInventoryService(this.repository);
    this.controller = new FeedInventoryController();
  }
}

export function createFeedInventoryModule(): FeedInventoryModule {
  return new FeedInventoryModule();
}
