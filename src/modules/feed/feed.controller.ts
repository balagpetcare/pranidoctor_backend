import type {
  CreateFeedItemBodyInput,
  ListFeedItemsQueryInput,
  UpdateFeedItemBodyInput,
} from './feed.validator.js';
import { getFeedService } from './feed.service.js';

export class FeedController {
  private readonly feed = getFeedService();

  listFeedItems(query: ListFeedItemsQueryInput, customerId?: string | null) {
    return this.feed.listFeedItems(query, customerId ?? null);
  }

  getFeedItemById(id: string, customerId?: string | null) {
    return this.feed.getFeedItemById(id, customerId ?? null);
  }

  createFeedItem(body: CreateFeedItemBodyInput, customerId?: string | null) {
    return this.feed.createFeedItem(body, customerId ?? null);
  }

  updateFeedItem(id: string, body: UpdateFeedItemBodyInput, customerId?: string | null) {
    return this.feed.updateFeedItem(id, body, customerId ?? null);
  }

  deactivateFeedItem(id: string, customerId?: string | null) {
    return this.feed.deactivateFeedItem(id, customerId ?? null);
  }
}

let controllerSingleton: FeedController | undefined;

export function getFeedController(): FeedController {
  if (!controllerSingleton) {
    controllerSingleton = new FeedController();
  }
  return controllerSingleton;
}
