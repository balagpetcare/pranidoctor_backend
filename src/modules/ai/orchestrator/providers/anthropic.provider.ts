import type { AiCompletionInput, AiCompletionOutput, AiProviderAdapter } from '../provider.interface.js';
import { createOrchestratorAdapter } from '../../providers/orchestrator-bridge.js';

export class AnthropicProvider implements AiProviderAdapter {
  readonly name = 'anthropic' as const;
  private delegate: AiProviderAdapter | null = null;

  private adapter(): AiProviderAdapter {
    if (!this.delegate) this.delegate = createOrchestratorAdapter('anthropic');
    return this.delegate;
  }

  isConfigured(): boolean {
    return this.adapter().isConfigured();
  }

  complete(input: AiCompletionInput): Promise<AiCompletionOutput> {
    return this.adapter().complete(input);
  }
}
