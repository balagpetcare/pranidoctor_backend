import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { AnimalsController } from './animals.controller.js';
import { AnimalsRepository } from './animals.repository.js';
import { configureAnimalsRoutes } from './animals.routes.js';
import { AnimalsService } from './animals.service.js';

export class AnimalsModule extends BaseModule {
  private controller!: AnimalsController;

  get metadata(): ModuleMetadata {
    return {
      name: 'animals',
      version: '1.0.0',
      dependencies: ['auth', 'users'],
      description: 'Animal management and medical records module',
    };
  }

  protected registerServices(): void {
    const repository = new AnimalsRepository();
    const service = new AnimalsService(repository);
    this.controller = new AnimalsController(service);

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureAnimalsRoutes(this.router, this.controller);
  }
}

export function createAnimalsModule(): AnimalsModule {
  return new AnimalsModule();
}
