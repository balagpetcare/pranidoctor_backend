import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { LeadsController } from './leads.controller.js';
import { LeadsRepository } from './leads.repository.js';
import { configureLeadsRoutes } from './leads.routes.js';
import { LeadsService } from './leads.service.js';

export class LeadsModule extends BaseModule {
  private controller!: LeadsController;

  get metadata(): ModuleMetadata {
    return {
      name: 'leads',
      version: '1.0.0',
      dependencies: ['auth', 'users'],
      description: 'Lead management and conversion tracking module',
    };
  }

  protected registerServices(): void {
    const repository = new LeadsRepository();
    const service = new LeadsService(repository);
    this.controller = new LeadsController(service);

    this.registerService(repository);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureLeadsRoutes(this.router, this.controller);
  }
}

export function createLeadsModule(): LeadsModule {
  return new LeadsModule();
}
