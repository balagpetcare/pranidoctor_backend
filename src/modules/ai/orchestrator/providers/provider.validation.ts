import { getAiPlatformConfig } from '../../config/ai.config.js';

export type ProviderValidationResult = {
  provider: 'openai' | 'anthropic';
  configured: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateOpenAiProvider(): ProviderValidationResult {
  const config = getAiPlatformConfig();
  const key = config.openaiApiKey;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!key) {
    return { provider: 'openai', configured: false, valid: true, errors, warnings };
  }

  if (key.length < 20) errors.push('OPENAI_API_KEY too short');
  if (!key.startsWith('sk-')) warnings.push('OPENAI_API_KEY format unexpected');
  if (!config.openaiModel.trim()) errors.push('OPENAI_MODEL is required');

  return {
    provider: 'openai',
    configured: true,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateAnthropicProvider(): ProviderValidationResult {
  const config = getAiPlatformConfig();
  const key = config.anthropicApiKey;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!key) {
    return { provider: 'anthropic', configured: false, valid: true, errors, warnings };
  }

  if (key.length < 20) errors.push('ANTHROPIC_API_KEY too short');
  if (!key.startsWith('sk-ant-')) warnings.push('ANTHROPIC_API_KEY format unexpected');
  if (!config.anthropicModel.trim()) errors.push('ANTHROPIC_MODEL is required');

  return {
    provider: 'anthropic',
    configured: true,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateAllLlmProviders(): ProviderValidationResult[] {
  return [validateOpenAiProvider(), validateAnthropicProvider()];
}
