import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { OfflineController, SyncController } from './offline-architecture.controller.js';
import { configureSyncRoutes } from './offline-architecture.routes.js';
import { getOfflineArchitectureService } from './offline-architecture.service.js';
import { getLocalCacheService } from './cache/local-cache.service.js';
import { getOfflineRepository } from './repository/offline.repository.js';
import { getSyncEngineService } from './sync/sync-engine.service.js';

export class SyncModule extends BaseModule {
  private controller!: SyncController;

  get metadata(): ModuleMetadata {
    return {
      name: 'sync',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'Offline sync engine — status, batch sync, retry',
    };
  }

  protected registerServices(): void {
    this.controller = new SyncController();
    this.registerService(getOfflineArchitectureService());
    this.registerService(getOfflineRepository());
    this.registerService(getSyncEngineService());
    this.registerService(getLocalCacheService());
  }

  protected configureRoutes(): void {
    configureSyncRoutes(this.router, this.controller);
  }
}

export function createSyncModule(): SyncModule {
  return new SyncModule();
}
