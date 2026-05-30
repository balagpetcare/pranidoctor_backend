export interface AiPlatformConfig {
  openaiApiKey: string | undefined;
  openaiModel: string;
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  preferredProvider: 'openai' | 'anthropic';
  llmRequired: boolean;
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
    openaiApiKey: env.OPENAI_API_KEY?.trim() || undefined,
    openaiModel: env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    anthropicModel: env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-haiku-20241022',
    preferredProvider: env.AI_PROVIDER?.trim().toLowerCase() === 'anthropic' ? 'anthropic' : 'openai',
    llmRequired: parseBoolean(env.AI_LLM_REQUIRED, llmRequiredDefault),
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

/** Validates AI secrets and provider config at startup. */
export function validateAiSecrets(config: AiPlatformConfig = getAiPlatformConfig()): {
  ok: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasOpenAi = Boolean(config.openaiApiKey);
  const hasAnthropic = Boolean(config.anthropicApiKey);

  if (config.llmRequired && !hasOpenAi && !hasAnthropic) {
    errors.push(
      'At least one LLM provider key is required (OPENAI_API_KEY or ANTHROPIC_API_KEY). Set AI_LLM_REQUIRED=false to disable.',
    );
  }

  if (hasOpenAi) {
    const key = config.openaiApiKey!;
    if (key.length < 20) {
      errors.push('OPENAI_API_KEY appears invalid (too short)');
    } else if (!key.startsWith('sk-')) {
      warnings.push('OPENAI_API_KEY does not start with sk- — verify key format');
    }
    if (!config.openaiModel.trim()) {
      errors.push('OPENAI_MODEL must not be empty when OPENAI_API_KEY is set');
    }
  }

  if (hasAnthropic) {
    const key = config.anthropicApiKey!;
    if (key.length < 20) {
      errors.push('ANTHROPIC_API_KEY appears invalid (too short)');
    } else if (!key.startsWith('sk-ant-')) {
      warnings.push('ANTHROPIC_API_KEY does not start with sk-ant- — verify key format');
    }
    if (!config.anthropicModel.trim()) {
      errors.push('ANTHROPIC_MODEL must not be empty when ANTHROPIC_API_KEY is set');
    }
  }

  if (!hasOpenAi && !hasAnthropic && !config.llmRequired) {
    warnings.push('No LLM API keys configured — rules-based fallback only');
  }

  if (config.dailyBudgetUsd == null && isNodeProduction()) {
    warnings.push('DAILY_AI_BUDGET_USD not set — platform daily spend cap disabled');
  }

  return { ok: errors.length === 0, errors, warnings };
}
