import type { AiCompletionInput, AiCompletionOutput, AiProviderAdapter } from '../provider.interface.js';
import { createOrchestratorAdapter } from '../../providers/orchestrator-bridge.js';

export class OpenAiProvider implements AiProviderAdapter {
  readonly name = 'openai' as const;
  private delegate: AiProviderAdapter | null = null;

  private adapter(): AiProviderAdapter {
    if (!this.delegate) this.delegate = createOrchestratorAdapter('openai');
    return this.delegate;
  }

  isConfigured(): boolean {
    return this.adapter().isConfigured();
  }

  complete(input: AiCompletionInput): Promise<AiCompletionOutput> {
    return this.adapter().complete(input);
  }
}
