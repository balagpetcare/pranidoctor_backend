import { getAiPlatformConfig } from '../../config/ai.config.js';
import { getAiSecretService } from '../../vault/ai-secret.service.js';

export type ProviderValidationResult = {
  provider: 'openai' | 'anthropic';
  configured: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateOpenAiProvider(): ProviderValidationResult {
  const config = getAiPlatformConfig();
  const configured = getAiSecretService().isProviderConfigured('openai');
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!configured) {
    return { provider: 'openai', configured: false, valid: true, errors, warnings };
  }

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
  const configured = getAiSecretService().isProviderConfigured('anthropic');
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!configured) {
    return { provider: 'anthropic', configured: false, valid: true, errors, warnings };
  }

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
