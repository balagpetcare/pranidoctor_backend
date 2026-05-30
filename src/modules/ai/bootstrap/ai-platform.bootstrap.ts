import type { AppConfig } from '../../../shared/config/config.schema.js';
import { logFatal, logInfo, logWarn } from '../../../shared/logger/logger.js';
import { validateAiSecrets } from '../config/ai.config.js';
import { validateAllLlmProviders } from '../orchestrator/providers/provider.validation.js';
import {
  runAiProviderHealthProbes,
  startAiHealthProbeScheduler,
  stopAiHealthProbeScheduler,
} from '../health/ai-health-probe.service.js';

export async function bootstrapAiPlatform(_config: AppConfig): Promise<void> {
  const secretCheck = validateAiSecrets();
  for (const w of secretCheck.warnings) {
    logWarn('AI platform config warning', { warning: w });
  }

  if (!secretCheck.ok) {
    const message = secretCheck.errors.join('; ');
    const nodeEnv = (_config.nodeEnv ?? 'development').trim();
    if (nodeEnv === 'production') {
      logFatal('AI platform secret validation failed', { errors: secretCheck.errors });
      throw new Error(message);
    }
    logWarn('AI platform secret validation failed (non-production)', { errors: secretCheck.errors });
  }

  const providers = validateAllLlmProviders();
  for (const p of providers) {
    if (p.configured && !p.valid) {
      const msg = `${p.provider} validation failed: ${p.errors.join(', ')}`;
      if ((_config.nodeEnv ?? 'development') === 'production') {
        throw new Error(msg);
      }
      logWarn(msg);
    }
  }

  logInfo('AI platform providers validated', {
    openai: providers.find((p) => p.provider === 'openai')?.configured ?? false,
    anthropic: providers.find((p) => p.provider === 'anthropic')?.configured ?? false,
  });

  const isTest = (_config.nodeEnv ?? 'development') === 'test';
  await runAiProviderHealthProbes({ persist: !isTest, skipNetwork: isTest });
  startAiHealthProbeScheduler();
  logInfo('AI provider health probes initialized');
}

export async function shutdownAiPlatform(): Promise<void> {
  stopAiHealthProbeScheduler();
}
