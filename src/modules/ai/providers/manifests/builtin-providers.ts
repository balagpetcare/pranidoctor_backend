/** Built-in LLM provider manifests — Phase 2 first-class catalog. */
export type BuiltinProviderManifest = {
  providerKey: string;
  displayName: string;
  description: string;
  priority: number;
  adapterType: string;
  baseUrl: string;
  capabilities: string[];
  defaultChatModel: string;
  secretPrefixHint?: string;
};

export const BUILTIN_PROVIDER_MANIFESTS: BuiltinProviderManifest[] = [
  {
    providerKey: 'openai',
    displayName: 'OpenAI',
    description: 'OpenAI chat, vision, and embeddings',
    priority: 10,
    adapterType: 'openai_native',
    baseUrl: 'https://api.openai.com/v1',
    capabilities: ['chat', 'vision', 'embeddings'],
    defaultChatModel: 'gpt-4o-mini',
    secretPrefixHint: 'sk-',
  },
  {
    providerKey: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude models via native API',
    priority: 20,
    adapterType: 'anthropic_native',
    baseUrl: 'https://api.anthropic.com/v1',
    capabilities: ['chat', 'vision'],
    defaultChatModel: 'claude-3-5-haiku-20241022',
    secretPrefixHint: 'sk-ant-',
  },
  {
    providerKey: 'gemini',
    displayName: 'Google Gemini',
    description: 'Gemini models via Generative Language API',
    priority: 30,
    adapterType: 'gemini_native',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    capabilities: ['chat', 'vision', 'embeddings'],
    defaultChatModel: 'gemini-1.5-flash',
    secretPrefixHint: 'AIza',
  },
  {
    providerKey: 'groq',
    displayName: 'Groq',
    description: 'Groq LPU inference (OpenAI-compatible)',
    priority: 40,
    adapterType: 'openai_compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    capabilities: ['chat'],
    defaultChatModel: 'llama-3.3-70b-versatile',
    secretPrefixHint: 'gsk_',
  },
  {
    providerKey: 'deepseek',
    displayName: 'DeepSeek',
    description: 'DeepSeek chat and embeddings',
    priority: 50,
    adapterType: 'openai_compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    capabilities: ['chat', 'embeddings'],
    defaultChatModel: 'deepseek-chat',
    secretPrefixHint: 'sk-',
  },
  {
    providerKey: 'openrouter',
    displayName: 'OpenRouter',
    description: 'Multi-model gateway',
    priority: 60,
    adapterType: 'openrouter_gateway',
    baseUrl: 'https://openrouter.ai/api/v1',
    capabilities: ['chat', 'vision', 'embeddings'],
    defaultChatModel: 'openai/gpt-4o-mini',
    secretPrefixHint: 'sk-or-',
  },
];

export function getBuiltinProviderManifest(providerKey: string): BuiltinProviderManifest | undefined {
  return BUILTIN_PROVIDER_MANIFESTS.find((m) => m.providerKey === providerKey);
}

export function listBuiltinProviderKeys(): string[] {
  return BUILTIN_PROVIDER_MANIFESTS.map((m) => m.providerKey);
}
