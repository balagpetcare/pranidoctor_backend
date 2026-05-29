import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { FeedRecommendationController } from './feed-recommendation.controller.js';
import { getFeedRecommendationService } from './feed-recommendation.service.js';

export class FeedRecommendationModule extends BaseModule {
  private controller!: FeedRecommendationController;

  get metadata(): ModuleMetadata {
    return {
      name: 'feed-recommendation',
      version: '1.0.0',
      dependencies: [],
      description: 'Phase 4 rule-based daily feed recommendation engine',
    };
  }

  protected registerServices(): void {
    this.controller = new FeedRecommendationController();
    this.registerService(getFeedRecommendationService());
  }

  protected configureRoutes(): void {
    // Routes wired via legacy mobile adapters in a later phase.
  }

  getController(): FeedRecommendationController {
    return this.controller;
  }
}

export function createFeedRecommendationModule(): FeedRecommendationModule {
  return new FeedRecommendationModule();
}
