import { getAiSecretService } from '../../vault/ai-secret.service.js';
import { OpenAiCompatibleProvider } from '../../providers/core/openai-compatible.provider.js';
import type {
  AiProviderCapability,
  ProviderRuntimeConfig,
} from '../../providers/core/ai-provider.types.js';

export type DynamicProviderOptions = {
  key: string;
  displayName: string;
  runtimeConfig: ProviderRuntimeConfig;
  /** Vault lookup key — defaults to provider key */
  secretProviderKey: string;
  capabilities?: readonly AiProviderCapability[];
};

/** DB- or manifest-driven OpenAI-compatible provider instance. */
export class DynamicOpenAiCompatibleProvider extends OpenAiCompatibleProvider {
  readonly key: string;
  readonly displayName: string;
  readonly capabilities: readonly AiProviderCapability[];

  private readonly runtimeConfig: ProviderRuntimeConfig;
  private readonly secretProviderKey: string;

  constructor(options: DynamicProviderOptions) {
    super();
    this.key = options.key;
    this.displayName = options.displayName;
    this.runtimeConfig = options.runtimeConfig;
    this.secretProviderKey = options.secretProviderKey;
    this.capabilities = options.capabilities ?? ['chat', 'vision', 'embeddings'];
  }

  protected override getConfig(): ProviderRuntimeConfig {
    return this.runtimeConfig;
  }

  override isConfigured(): boolean {
    return getAiSecretService().isProviderConfigured(this.secretProviderKey);
  }
}
