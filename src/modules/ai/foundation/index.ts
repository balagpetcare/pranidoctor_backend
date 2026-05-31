export {
  getAiFoundationService,
  resetAiFoundationServiceForTests,
  AiFoundationService,
} from './ai-foundation.service.js';
export type {
  AiTaskRequest,
  AiTaskResult,
  AiTaskUsageDto,
  AiTaskTraceDto,
  AiPromptTaskRequest,
  AiFoundationStatusDto,
  AiFoundationScope,
  AiFoundationLocale,
} from './ai-foundation.types.js';
export { resolveFoundationScope, buildScopeKey, scopeKeysForHierarchy } from './ai-scope.util.js';
export { resolveTaskTypeForFeature, listFeatureTaskMappings } from './feature-task-map.js';
