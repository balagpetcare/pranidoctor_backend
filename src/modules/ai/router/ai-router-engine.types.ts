import type { ResolvedRoute, RouteHop } from '../routing/ai-router.types.js';
import type {
  FailoverExecutionRequest,
  FailoverExecutionResult,
  FailoverHopAttempt,
  FailoverHopContext,
  FailoverHopExecutor,
  FailoverTier,
} from '../failover/failover.types.js';
import type { AiCompletionInput, AiCompletionOutput } from '../orchestrator/provider.interface.js';
import type { AiEmbedOutput } from '../providers/core/ai-provider.types.js';

export type RouterEngineExecutionRequest = FailoverExecutionRequest;

export type RouterEngineExecutionResult<T> = FailoverExecutionResult<T>;

export type RouterCompletionInput = AiCompletionInput & {
  userId?: string;
  customerId?: string;
  scopeKey?: string;
  tenantId?: string;
  branchId?: string;
};

export type RouterCompletionResult = AiCompletionOutput & {
  routerMeta?: {
    routeId: string;
    hopIndex: number;
    isFallback: boolean;
    attemptCount: number;
  };
};

export type RouterEmbeddingInput = {
  feature: string;
  texts: string[];
  taskType?: string;
  scopeKey?: string;
  tenantId?: string;
  branchId?: string;
};

export type RouterEmbeddingResult = AiEmbedOutput & {
  routerMeta?: {
    routeId: string;
    hopIndex: number;
    isFallback: boolean;
    attemptCount: number;
  };
};

export type HopExecutionContext = FailoverHopContext;

export type HopExecutor<T> = FailoverHopExecutor<T>;

export { FailoverHopAttempt, FailoverTier, ResolvedRoute, RouteHop };
