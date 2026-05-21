import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { OfflineController } from './offline-architecture.controller.js';
import { configureOfflineRoutes } from './offline-architecture.routes.js';
import { getOfflineArchitectureService } from './offline-architecture.service.js';
import { getOfflineRepository } from './repository/offline.repository.js';

export class OfflineModule extends BaseModule {
  private controller!: OfflineController;

  get metadata(): ModuleMetadata {
    return {
      name: 'offline',
      version: '1.0.0',
      dependencies: ['auth', 'sync'],
      description: 'Offline queue visibility — queued, syncing, failed, resolved',
    };
  }

  protected registerServices(): void {
    this.controller = new OfflineController();
    this.registerService(getOfflineArchitectureService());
    this.registerService(getOfflineRepository());
  }

  protected configureRoutes(): void {
    configureOfflineRoutes(this.router, this.controller);
  }
}

export function createOfflineModule(): OfflineModule {
  return new OfflineModule();
}
