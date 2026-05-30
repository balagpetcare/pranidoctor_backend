export type {
  AiTaskType,
  AiDbTaskType,
  AiRouteModality,
} from './ai-task.types.js';
export {
  AI_TASK_TYPES,
  AI_DB_TASK_TYPES,
  normalizeAiTaskType,
  toPascalAiTaskType,
  isSupportedAiTaskType,
  modalityForTask,
} from './ai-task.types.js';

export type {
  AiRouteRequest,
  ResolvedRoute,
  RouteHop,
  ProviderChainEntry,
  ModelSelectionInput,
  SelectedModel,
} from './ai-router.types.js';
export { AiRouteNotFoundError, AiModelNotFoundError } from './ai-router.errors.js';
export { buildScopeKey, scopeKeysForResolution, PLATFORM_SCOPE_KEY } from './scope.util.js';
export { parseProviderChainJson } from './provider-chain.util.js';
export { RouteResolver, getRouteResolver, resetRouteResolverForTests } from './route-resolver.js';
export { ModelSelector, getModelSelector, resetModelSelectorForTests } from './model-selector.js';
export {
  AIRouterService,
  getAIRouterService,
  resetAIRouterServiceForTests,
} from './ai-router.service.js';
