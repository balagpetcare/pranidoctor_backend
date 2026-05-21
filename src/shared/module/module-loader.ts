import type { Express } from 'express';

import { getLogger } from '../logger/logger.js';

import { moduleRegistry } from './module-registry.js';
import type { ModuleDefinition } from './module.types.js';

export interface ModuleLoaderOptions {
  apiPrefix?: string;
}

export async function loadModules(
  app: Express,
  modules: ModuleDefinition[],
  options: ModuleLoaderOptions = {}
): Promise<void> {
  const logger = getLogger();
  const { apiPrefix = '/api' } = options;

  logger.info({ msg: 'Loading modules', count: modules.length });

  for (const module of modules) {
    moduleRegistry.register(module);
  }

  await moduleRegistry.initialize();

  const routers = moduleRegistry.getAllRouters();
  for (const [name, router] of routers) {
    const path = `${apiPrefix}/${name}`;
    app.use(path, router);
    logger.info({ msg: 'Module routes mounted', module: name, path });
  }

  logger.info({ msg: 'All modules loaded and mounted' });
}

export async function unloadModules(): Promise<void> {
  await moduleRegistry.shutdown();
  moduleRegistry.clear();
}

export function getModuleService<T>(moduleName: string, serviceName: string): T {
  return moduleRegistry.getService(moduleName, serviceName) as T;
}
