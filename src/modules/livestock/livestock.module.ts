import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { getLivestockController, LivestockController } from './livestock.controller.js';
import { getLivestockRepository } from './livestock.repository.js';
import { configureLivestockRoutes } from './livestock.routes.js';
import { getLivestockService } from './livestock.service.js';

export class LivestockModule extends BaseModule {
  private controller!: LivestockController;

  get metadata(): ModuleMetadata {
    return {
      name: 'livestock',
      version: '1.0.0',
      dependencies: ['auth', 'users'],
      description: 'Phase 4 livestock registry module',
    };
  }

  protected registerServices(): void {
    const repository = getLivestockRepository();
    const service = getLivestockService();
    this.controller = getLivestockController();

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureLivestockRoutes(this.router, this.controller);
  }
}

export function createLivestockModule(): LivestockModule {
  return new LivestockModule();
}
