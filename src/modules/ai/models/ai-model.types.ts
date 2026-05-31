import type { AiModel, AiModelFamily, AiModelSource, AiProvider } from '../../../generated/prisma/index.js';

export const AI_MODEL_FAMILIES = [
  'gpt',
  'gemini',
  'claude',
  'deepseek',
  'qwen',
  'llama',
  'grok',
] as const satisfies readonly AiModelFamily[];

export type AiModelFamilyKey = (typeof AI_MODEL_FAMILIES)[number];

export const AI_CAPABILITIES = [
  'chat',
  'vision',
  'embeddings',
  'function_calling',
  'json_mode',
  'streaming',
  'reasoning',
  'audio_input',
  'audio_output',
  'document_pdf',
  'code_optimized',
] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];

export type AiModelMetadata = {
  vendor?: string;
  releaseDate?: string;
  trainingCutoff?: string;
  supportsStreaming?: boolean;
  supportsToolCalling?: boolean;
  supportsJsonMode?: boolean;
  supportsVision?: boolean;
  license?: 'commercial' | 'open' | 'research_only';
  tags?: string[];
  documentationUrl?: string;
  upstreamStatus?: 'active' | 'deprecated' | 'preview';
};

export type AiModelLifecycle = 'registered' | 'enabled' | 'deprecated' | 'retired';

export type AiModelEconomicsDto = {
  inputCostPerToken: number;
  outputCostPerToken: number;
  cachedInputCostPerToken: number | null;
  batchInputCostPerToken: number | null;
  batchOutputCostPerToken: number | null;
  rateVersion: number;
  currency: string;
};

export type AiModelAdminDto = {
  id: string;
  scopeKey: string;
  providerId: string;
  providerKey: string;
  providerName: string;
  modelKey: string;
  externalModelId: string | null;
  modelFamily: AiModelFamily | null;
  displayName: string;
  modelType: string;
  modelCategory: string;
  enabled: boolean;
  isDefault: boolean;
  lifecycle: AiModelLifecycle;
  contextWindow: number | null;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  contextWindowSource: string;
  capabilities: AiCapability[];
  economics: AiModelEconomicsDto;
  metadata: AiModelMetadata | null;
  source: AiModelSource;
  version: number;
  deprecatedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiModelFamilySummary = {
  family: AiModelFamilyKey;
  displayName: string;
  modelCount: number;
  enabledCount: number;
  providers: string[];
};

export type AiModelRateHistoryDto = {
  id: string;
  rateVersion: number;
  inputCostPerToken: number;
  outputCostPerToken: number;
  cachedInputCostPerToken: number | null;
  batchInputCostPerToken: number | null;
  batchOutputCostPerToken: number | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string | null;
  source: string;
};

export type AiModelWithProvider = AiModel & {
  provider: Pick<AiProvider, 'providerKey' | 'displayName'>;
};

export const AI_MODEL_FAMILY_LABELS: Record<AiModelFamilyKey, string> = {
  gpt: 'GPT (OpenAI)',
  gemini: 'Gemini (Google)',
  claude: 'Claude (Anthropic)',
  deepseek: 'DeepSeek',
  qwen: 'Qwen (Alibaba)',
  llama: 'Llama (Meta)',
  grok: 'Grok (xAI)',
};

export const PROVIDER_FAMILY_HINTS: Record<string, AiModelFamilyKey[]> = {
  openai: ['gpt'],
  anthropic: ['claude'],
  gemini: ['gemini'],
  deepseek: ['deepseek'],
  groq: ['llama'],
  grok: ['grok'],
  openrouter: ['gpt', 'gemini', 'claude', 'deepseek', 'qwen', 'llama', 'grok'],
};
