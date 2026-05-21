import { Router } from 'express';

import type { ModuleDefinition, ModuleMetadata, ModuleService } from './module.types.js';

export abstract class BaseModule implements ModuleDefinition {
  public readonly router: Router;
  public readonly services: Map<string, ModuleService> = new Map();

  constructor() {
    this.router = Router();
  }

  abstract get metadata(): ModuleMetadata;

  protected registerService(service: ModuleService): void {
    this.services.set(service.name, service);
  }

  protected abstract configureRoutes(): void;

  protected abstract registerServices(): void;

  async initialize(): Promise<void> {
    this.registerServices();
    this.configureRoutes();

    for (const service of this.services.values()) {
      if (service.initialize) {
        await service.initialize();
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const service of this.services.values()) {
      if (service.shutdown) {
        await service.shutdown();
      }
    }
  }
}
