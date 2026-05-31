import type { RouteHop } from '../../routing/ai-router.types.js';
import type {
  AiCompletionInput,
  AiCompletionOutput,
  AiProviderAdapter,
} from '../../orchestrator/provider.interface.js';
import {
  getProviderAdapterFactory,
  type IProviderAdapterFactory,
} from './provider-adapter.factory.js';

/** Applies registry-resolved model identity to provider adapter calls. */
export interface IModelInvocationAdapter {
  complete(input: AiCompletionInput, hop: RouteHop): Promise<AiCompletionOutput>;
}

export class ModelInvocationAdapter implements IModelInvocationAdapter {
  readonly name = 'ModelInvocationAdapter';

  constructor(
    private readonly providerFactory: IProviderAdapterFactory = getProviderAdapterFactory(),
  ) {}

  async complete(input: AiCompletionInput, hop: RouteHop): Promise<AiCompletionOutput> {
    const adapter = this.resolveAdapter(hop);
    const enriched = this.enrichInput(input, hop);
    const output = await adapter.complete(enriched);
    return {
      ...output,
      model: hop.modelKey,
      provider: hop.providerKey,
      trace: {
        ...output.trace,
        providerId: hop.providerId,
        modelId: hop.modelId,
      },
    };
  }

  resolveAdapter(hop: RouteHop): AiProviderAdapter {
    return this.providerFactory.create(hop.providerKey);
  }

  enrichInput(input: AiCompletionInput, hop: RouteHop): AiCompletionInput {
    return {
      ...input,
      resolvedModelKey: hop.modelKey,
      resolvedModelId: hop.modelId,
      hopIndex: hop.order,
    };
  }
}

let modelInvocationAdapter: ModelInvocationAdapter | null = null;

export function getModelInvocationAdapter(): ModelInvocationAdapter {
  if (!modelInvocationAdapter) modelInvocationAdapter = new ModelInvocationAdapter();
  return modelInvocationAdapter;
}

export function resetModelInvocationAdapterForTests(): void {
  modelInvocationAdapter = null;
}
