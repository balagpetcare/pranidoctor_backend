import type { AiModelFamily } from '../../../../generated/prisma/index.js';
import type { AiCapability } from '../ai-model.types.js';

export type BuiltinModelManifestEntry = {
  providerKey: string;
  modelKey: string;
  displayName: string;
  modelFamily: AiModelFamily;
  modelType: string;
  modelCategory: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPerToken: number;
  outputCostPerToken: number;
  isDefault?: boolean;
  capabilities: AiCapability[];
  externalModelId?: string;
};

export const BUILTIN_FAMILY_MODEL_MANIFESTS: BuiltinModelManifestEntry[] = [
  {
    providerKey: 'openai',
    modelKey: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    modelFamily: 'gpt',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputCostPerToken: 0.00000015,
    outputCostPerToken: 0.0000006,
    isDefault: true,
    capabilities: ['chat', 'vision', 'function_calling', 'streaming', 'json_mode'],
  },
  {
    providerKey: 'openai',
    modelKey: 'gpt-4o',
    displayName: 'GPT-4o',
    modelFamily: 'gpt',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputCostPerToken: 0.0000025,
    outputCostPerToken: 0.00001,
    capabilities: ['chat', 'vision', 'function_calling', 'streaming', 'json_mode'],
  },
  {
    providerKey: 'openrouter',
    modelKey: 'openai/gpt-4o-mini',
    displayName: 'GPT-4o Mini (OpenRouter)',
    modelFamily: 'gpt',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputCostPerToken: 0.00000015,
    outputCostPerToken: 0.0000006,
    isDefault: true,
    capabilities: ['chat', 'vision', 'function_calling', 'streaming', 'json_mode'],
    externalModelId: 'openai/gpt-4o-mini',
  },
  {
    providerKey: 'gemini',
    modelKey: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    modelFamily: 'gemini',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 1_000_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.000000075,
    outputCostPerToken: 0.0000003,
    isDefault: true,
    capabilities: ['chat', 'vision', 'streaming', 'json_mode'],
  },
  {
    providerKey: 'gemini',
    modelKey: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    modelFamily: 'gemini',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 1_000_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.0000001,
    outputCostPerToken: 0.0000004,
    capabilities: ['chat', 'vision', 'streaming', 'json_mode'],
  },
  {
    providerKey: 'anthropic',
    modelKey: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    modelFamily: 'claude',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.0000008,
    outputCostPerToken: 0.000004,
    isDefault: true,
    capabilities: ['chat', 'vision', 'function_calling', 'streaming', 'json_mode'],
  },
  {
    providerKey: 'anthropic',
    modelKey: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    modelFamily: 'claude',
    modelType: 'chat',
    modelCategory: 'reasoning',
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.000003,
    outputCostPerToken: 0.000015,
    capabilities: ['chat', 'vision', 'function_calling', 'streaming', 'json_mode', 'reasoning'],
  },
  {
    providerKey: 'deepseek',
    modelKey: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    modelFamily: 'deepseek',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 64_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.00000014,
    outputCostPerToken: 0.00000028,
    isDefault: true,
    capabilities: ['chat', 'streaming', 'json_mode'],
  },
  {
    providerKey: 'deepseek',
    modelKey: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    modelFamily: 'deepseek',
    modelType: 'chat',
    modelCategory: 'reasoning',
    contextWindow: 64_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.00000055,
    outputCostPerToken: 0.00000219,
    capabilities: ['chat', 'streaming', 'reasoning'],
  },
  {
    providerKey: 'groq',
    modelKey: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B (Groq)',
    modelFamily: 'llama',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.00000059,
    outputCostPerToken: 0.00000079,
    isDefault: true,
    capabilities: ['chat', 'streaming'],
  },
  {
    providerKey: 'openrouter',
    modelKey: 'meta-llama/llama-3.3-70b-instruct',
    displayName: 'Llama 3.3 70B (OpenRouter)',
    modelFamily: 'llama',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.00000012,
    outputCostPerToken: 0.00000012,
    capabilities: ['chat', 'streaming'],
    externalModelId: 'meta-llama/llama-3.3-70b-instruct',
  },
  {
    providerKey: 'openrouter',
    modelKey: 'qwen/qwen-2.5-72b-instruct',
    displayName: 'Qwen 2.5 72B (OpenRouter)',
    modelFamily: 'qwen',
    modelType: 'chat',
    modelCategory: 'code',
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.00000035,
    outputCostPerToken: 0.0000004,
    isDefault: true,
    capabilities: ['chat', 'streaming', 'code_optimized'],
    externalModelId: 'qwen/qwen-2.5-72b-instruct',
  },
  {
    providerKey: 'grok',
    modelKey: 'grok-2-1212',
    displayName: 'Grok 2',
    modelFamily: 'grok',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 131_072,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.000002,
    outputCostPerToken: 0.00001,
    isDefault: true,
    capabilities: ['chat', 'vision', 'streaming', 'json_mode'],
  },
  {
    providerKey: 'openrouter',
    modelKey: 'x-ai/grok-2',
    displayName: 'Grok 2 (OpenRouter)',
    modelFamily: 'grok',
    modelType: 'chat',
    modelCategory: 'general_chat',
    contextWindow: 131_072,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.000002,
    outputCostPerToken: 0.00001,
    capabilities: ['chat', 'vision', 'streaming', 'json_mode'],
    externalModelId: 'x-ai/grok-2',
  },
];

export function inferModelFamily(modelKey: string): AiModelFamily | null {
  const key = modelKey.toLowerCase();
  if (key.includes('gpt') || key.startsWith('openai/') || key.startsWith('o1') || key.startsWith('o3')) {
    return 'gpt';
  }
  if (key.includes('gemini') || key.startsWith('google/')) return 'gemini';
  if (key.includes('claude') || key.startsWith('anthropic/')) return 'claude';
  if (key.includes('deepseek')) return 'deepseek';
  if (key.includes('qwen')) return 'qwen';
  if (key.includes('llama') || key.startsWith('meta-llama/')) return 'llama';
  if (key.includes('grok') || key.startsWith('x-ai/')) return 'grok';
  return null;
}
