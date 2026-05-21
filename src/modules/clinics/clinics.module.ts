import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { ClinicsController } from './clinics.controller.js';
import { ClinicsRepository } from './clinics.repository.js';
import { configureClinicsRoutes } from './clinics.routes.js';
import { ClinicsService } from './clinics.service.js';

export class ClinicsModule extends BaseModule {
  private controller!: ClinicsController;

  get metadata(): ModuleMetadata {
    return {
      name: 'clinics',
      version: '1.0.0',
      dependencies: ['auth', 'users', 'doctors'],
      description: 'Clinic management and services module',
    };
  }

  protected registerServices(): void {
    const repository = new ClinicsRepository();
    const service = new ClinicsService(repository);
    this.controller = new ClinicsController(service);

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureClinicsRoutes(this.router, this.controller);
  }
}

export function createClinicsModule(): ClinicsModule {
  return new ClinicsModule();
}
