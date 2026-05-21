import type { Router } from 'express';

import { getLogger } from '../logger/logger.js';

import { dependencyGuard } from './dependency-guard.js';
import type { ModuleDefinition, ModuleService } from './module.types.js';

class ModuleRegistry {
  private modules: Map<string, ModuleDefinition> = new Map();
  private initialized = false;

  register(module: ModuleDefinition): void {
    const logger = getLogger();

    if (this.initialized) {
      throw new Error('Cannot register modules after initialization');
    }

    if (this.modules.has(module.metadata.name)) {
      throw new Error(`Module '${module.metadata.name}' is already registered`);
    }

    dependencyGuard.registerModule(module.metadata);
    this.modules.set(module.metadata.name, module);

    logger.debug({
      msg: 'Module registered',
      module: module.metadata.name,
      version: module.metadata.version,
      dependencies: module.metadata.dependencies,
    });
  }

  async initialize(): Promise<void> {
    const logger = getLogger();

    if (this.initialized) {
      throw new Error('Modules already initialized');
    }

    dependencyGuard.validate();

    const order = dependencyGuard.getInitializationOrder();
    logger.info({ msg: 'Initializing modules', order });

    for (const moduleName of order) {
      const module = this.modules.get(moduleName);
      if (module) {
        logger.debug({ msg: 'Initializing module', module: moduleName });
        await module.initialize();
        logger.info({ msg: 'Module initialized', module: moduleName });
      }
    }

    this.initialized = true;
    logger.info({ msg: 'All modules initialized', count: this.modules.size });
  }

  async shutdown(): Promise<void> {
    const logger = getLogger();

    if (!this.initialized) {
      return;
    }

    const order = dependencyGuard.getShutdownOrder();
    logger.info({ msg: 'Shutting down modules', order });

    for (const moduleName of order) {
      const module = this.modules.get(moduleName);
      if (module) {
        logger.debug({ msg: 'Shutting down module', module: moduleName });
        await module.shutdown();
        logger.info({ msg: 'Module shut down', module: moduleName });
      }
    }

    this.initialized = false;
    logger.info({ msg: 'All modules shut down' });
  }

  getModule(name: string): ModuleDefinition | undefined {
    return this.modules.get(name);
  }

  getService<T extends ModuleService>(moduleName: string, serviceName: string): T {
    const module = this.modules.get(moduleName);
    if (!module) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const service = module.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found in module '${moduleName}'`);
    }

    return service as T;
  }

  getRouter(name: string): Router | undefined {
    return this.modules.get(name)?.router;
  }

  getAllRouters(): Map<string, Router> {
    const routers = new Map<string, Router>();
    for (const [name, module] of this.modules) {
      routers.set(name, module.router);
    }
    return routers;
  }

  getModuleNames(): string[] {
    return Array.from(this.modules.keys());
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  clear(): void {
    this.modules.clear();
    this.initialized = false;
    dependencyGuard.clear();
  }
}

export const moduleRegistry = new ModuleRegistry();
