import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { AreaEngineController } from './area-engine.controller.js';
import { configureAreaEngineRoutes } from './area-engine.routes.js';
import { getAreaCacheService } from './cache/area-cache.service.js';
import { getAreaRepository } from './repository/area.repository.js';

export class AreaEngineModule extends BaseModule {
  private controller!: AreaEngineController;

  get metadata(): ModuleMetadata {
    return {
      name: 'area',
      version: '1.0.0',
      dependencies: [],
      description: 'Bangladesh area hierarchy engine — divisions through villages',
    };
  }

  protected registerServices(): void {
    this.controller = new AreaEngineController();
    this.registerService(getAreaRepository());
  }

  protected configureRoutes(): void {
    configureAreaEngineRoutes(this.router, this.controller);
  }

  override async initialize(): Promise<void> {
    await super.initialize();
    try {
      await getAreaCacheService().warmupDivisions(1, 100, async () => {
        await getAreaRepository().listDivisions({ page: 1, pageSize: 100 });
      });
    } catch {
      // warmup is best-effort
    }
  }
}

export function createAreaEngineModule(): AreaEngineModule {
  return new AreaEngineModule();
}
