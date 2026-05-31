import { getAiRouterEngine } from '../router/ai-router-engine.service.js';
import type {
  FailoverExecutionRequest,
  FailoverExecutionResult,
  FailoverHopExecutor,
} from './failover.types.js';
import type { RouteHop, ResolvedRoute } from '../routing/ai-router.types.js';

/**
 * @deprecated Prefer getAiRouterEngine() — thin delegate for backward compatibility.
 */
export class AIFailoverService {
  readonly name = 'AIFailoverService';

  private readonly engine = getAiRouterEngine();

  async execute<T>(
    request: FailoverExecutionRequest,
    executor: FailoverHopExecutor<T>,
  ): Promise<FailoverExecutionResult<T>> {
    return this.engine.execute(request, executor);
  }

  getPrimarySecondaryTertiary(route: ResolvedRoute): {
    primary?: RouteHop;
    secondary?: RouteHop;
    tertiary?: RouteHop;
  } {
    return {
      ...(route.hops[0] ? { primary: route.hops[0] } : {}),
      ...(route.hops[1] ? { secondary: route.hops[1] } : {}),
      ...(route.hops[2] ? { tertiary: route.hops[2] } : {}),
    };
  }
}

let aiFailoverService: AIFailoverService | null = null;

export function getAIFailoverService(): AIFailoverService {
  if (!aiFailoverService) aiFailoverService = new AIFailoverService();
  return aiFailoverService;
}

export function resetAIFailoverServiceForTests(): void {
  aiFailoverService = null;
}
