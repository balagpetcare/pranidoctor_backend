export { BaseModule } from './base-module.js';
export {
  dependencyGuard,
  DependencyGuard,
  CircularDependencyError,
  MissingDependencyError,
} from './dependency-guard.js';
export { loadModules, unloadModules, getModuleService } from './module-loader.js';
export { moduleRegistry } from './module-registry.js';
export {
  ModuleNames,
  type ModuleDefinition,
  type ModuleFactory,
  type ModuleMetadata,
  type ModuleName,
  type ModuleService,
  type DependencyGraph,
  type DependencyNode,
} from './module.types.js';
