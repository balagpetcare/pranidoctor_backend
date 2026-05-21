import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { DoctorsController } from './doctors.controller.js';
import { DoctorsRepository } from './doctors.repository.js';
import { configureDoctorsRoutes } from './doctors.routes.js';
import { DoctorsService } from './doctors.service.js';

export class DoctorsModule extends BaseModule {
  private controller!: DoctorsController;

  get metadata(): ModuleMetadata {
    return {
      name: 'doctors',
      version: '1.0.0',
      dependencies: ['auth', 'users'],
      description: 'Doctor management and verification module',
    };
  }

  protected registerServices(): void {
    const repository = new DoctorsRepository();
    const service = new DoctorsService(repository);
    this.controller = new DoctorsController(service);

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureDoctorsRoutes(this.router, this.controller);
  }
}

export function createDoctorsModule(): DoctorsModule {
  return new DoctorsModule();
}
