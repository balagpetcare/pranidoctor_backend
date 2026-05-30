import { getEncryptionService } from '../vault/encryption.service.js';
import { getAiSecretService } from '../vault/ai-secret.service.js';

export interface AiPlatformConfig {
  openaiModel: string;
  anthropicModel: string;
  preferredProvider: 'openai' | 'anthropic';
  llmRequired: boolean;
  vaultMasterKeyConfigured: boolean;
  healthProbeEnabled: boolean;
  healthProbeIntervalSec: number;
  dailyBudgetUsd: number | null;
  monthlyBudgetUsd: number | null;
  usageSpikeMultiplier: number;
  organizationId: string | undefined;
  branchId: string | undefined;
}

function nodeEnv(): string {
  return (process.env.NODE_ENV ?? 'development').trim();
}

function isNodeProduction(): boolean {
  return nodeEnv() === 'production';
}

function isNodeTest(): boolean {
  return nodeEnv() === 'test';
}

function parseOptionalUsd(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value !== 'false' && value !== '0';
}

export function loadAiPlatformConfig(): AiPlatformConfig {
  const env = process.env;
  const llmRequiredDefault = isNodeProduction() && !isNodeTest();

  return {
    openaiModel: env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    anthropicModel: env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-haiku-20241022',
    preferredProvider: env.AI_PROVIDER?.trim().toLowerCase() === 'anthropic' ? 'anthropic' : 'openai',
    llmRequired: parseBoolean(env.AI_LLM_REQUIRED, llmRequiredDefault),
    vaultMasterKeyConfigured: getEncryptionService().isMasterKeyConfigured(),
    healthProbeEnabled: parseBoolean(env.AI_HEALTH_PROBE_ENABLED, isNodeProduction() && !isNodeTest()),
    healthProbeIntervalSec: Math.max(60, Number.parseInt(env.AI_HEALTH_PROBE_INTERVAL_SEC ?? '300', 10) || 300),
    dailyBudgetUsd: parseOptionalUsd(env.DAILY_AI_BUDGET_USD),
    monthlyBudgetUsd: parseOptionalUsd(env.MONTHLY_AI_BUDGET_USD),
    usageSpikeMultiplier: Math.max(2, Number.parseFloat(env.AI_USAGE_SPIKE_MULTIPLIER ?? '3') || 3),
    organizationId: env.TENANT_ID?.trim() || env.ORGANIZATION_ID?.trim() || undefined,
    branchId: env.DEPLOYMENT_BRANCH?.trim() || env.BRANCH_ID?.trim() || undefined,
  };
}

let cached: AiPlatformConfig | null = null;

export function getAiPlatformConfig(): AiPlatformConfig {
  if (!cached) cached = loadAiPlatformConfig();
  return cached;
}

export function resetAiPlatformConfigCache(): void {
  cached = null;
}

/** Validates AI vault + provider config at startup. */
export async function validateAiSecrets(
  config: AiPlatformConfig = getAiPlatformConfig(),
): Promise<{
  ok: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.llmRequired && !config.vaultMasterKeyConfigured) {
    errors.push(
      'AI_VAULT_MASTER_KEY is required when AI_LLM_REQUIRED=true. Provider API keys are stored encrypted in the database vault.',
    );
  }

  await getAiSecretService().refreshConfigurationCache();
  const hasOpenAi = getAiSecretService().isProviderConfigured('openai');
  const hasAnthropic = getAiSecretService().isProviderConfigured('anthropic');

  if (config.llmRequired && !hasOpenAi && !hasAnthropic) {
    errors.push(
      'At least one active provider API key is required in the vault (openai or anthropic). Add keys via admin AI secrets API.',
    );
  }

  if (hasOpenAi && !config.openaiModel.trim()) {
    errors.push('OPENAI_MODEL must not be empty when OpenAI vault key is active');
  }

  if (hasAnthropic && !config.anthropicModel.trim()) {
    errors.push('ANTHROPIC_MODEL must not be empty when Anthropic vault key is active');
  }

  if (!hasOpenAi && !hasAnthropic && !config.llmRequired) {
    warnings.push('No active vault API keys — rules-based fallback only');
  }

  if (process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim()) {
    warnings.push(
      'OPENAI_API_KEY / ANTHROPIC_API_KEY in environment are ignored — use the AI vault (admin API or db:seed:ai-management with AI_VAULT_MASTER_KEY).',
    );
  }

  if (config.dailyBudgetUsd == null && isNodeProduction()) {
    warnings.push('DAILY_AI_BUDGET_USD not set — platform daily spend cap disabled');
  }

  return { ok: errors.length === 0, errors, warnings };
}
