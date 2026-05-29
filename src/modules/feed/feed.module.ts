import { FeedController } from './feed.controller.js';
import { FeedRepository } from './feed.repository.js';
import { FeedService } from './feed.service.js';

export class FeedModule {
  readonly repository: FeedRepository;
  readonly service: FeedService;
  readonly controller: FeedController;

  constructor() {
    this.repository = new FeedRepository();
    this.service = new FeedService(this.repository);
    this.controller = new FeedController();
  }
}

export function createFeedModule(): FeedModule {
  return new FeedModule();
}
