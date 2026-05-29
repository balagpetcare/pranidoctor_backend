import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { FeedConsumptionController } from './feed-consumption.controller.js';
import { getFeedConsumptionService } from './feed-consumption.service.js';

export class FeedConsumptionModule extends BaseModule {
  private controller!: FeedConsumptionController;

  get metadata(): ModuleMetadata {
    return {
      name: 'feed-consumption',
      version: '1.0.0',
      dependencies: [],
      description: 'Phase 4 feed consumption logging with optional inventory deduct',
    };
  }

  protected registerServices(): void {
    this.controller = new FeedConsumptionController();
    this.registerService(getFeedConsumptionService());
  }

  protected configureRoutes(): void {
    // Routes wired via legacy mobile adapters in a later phase.
  }

  getController(): FeedConsumptionController {
    return this.controller;
  }
}

export function createFeedConsumptionModule(): FeedConsumptionModule {
  return new FeedConsumptionModule();
}
