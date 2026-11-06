import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { DiscoveryController } from './discovery.controller.js';
import { DiscoveryRepository } from './discovery.repository.js';
import { configureDiscoveryRoutes } from './discovery.routes.js';
import { DiscoveryService } from './discovery.service.js';

/**
 * Service discovery for the customer app: service hub (live counts), unified provider
 * search (doctors, AI technicians, health workers) and provider presence.
 * Mounted at `/api/discovery`.
 */
export class DiscoveryModule extends BaseModule {
  private controller!: DiscoveryController;

  get metadata(): ModuleMetadata {
    return {
      name: 'discovery',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'Service hub, provider search and presence',
    };
  }

  protected registerServices(): void {
    const service = new DiscoveryService(new DiscoveryRepository());
    this.controller = new DiscoveryController(service);
    this.registerService(service);
  }

  protected configureRoutes(): void {
    configureDiscoveryRoutes(this.router, this.controller);
  }
}

export function createDiscoveryModule(): DiscoveryModule {
  return new DiscoveryModule();
}
