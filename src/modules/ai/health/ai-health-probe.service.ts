import { getPrisma } from '../../../shared/database/prisma.js';
import { getLogger } from '../../../shared/logger/logger.js';
import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import { getAiPlatformConfig } from '../config/ai.config.js';
import { classifyProviderError } from '../usage/ai-usage.errors.js';
import {
  recordProviderHealthMetric,
  setProviderUpMetric,
} from '../usage/ai-usage.metrics.js';
import { OpenAiProvider } from '../orchestrator/providers/openai.provider.js';
import { AnthropicProvider } from '../orchestrator/providers/anthropic.provider.js';

export type ProviderHealthStatus = {
  provider: string;
  configured: boolean;
  reachable: boolean;
  latencyMs: number;
  errorCode?: string;
  lastProbedAt: string;
};

const PROBE_INPUT = {
  feature: 'HEALTH_PROBE',
  systemPrompt: 'Reply with OK only.',
  userMessage: 'ping',
  locale: 'en' as const,
  maxTokens: 5,
  temperature: 0,
};

let latestSnapshot: Map<string, ProviderHealthStatus> = new Map();
let probeTimer: ReturnType<typeof setInterval> | null = null;

async function probeProvider(
  provider: 'openai' | 'anthropic',
): Promise<ProviderHealthStatus> {
  const adapter = provider === 'openai' ? new OpenAiProvider() : new AnthropicProvider();
  const configured = adapter.isConfigured();

  if (!configured) {
    const status: ProviderHealthStatus = {
      provider,
      configured: false,
      reachable: false,
      latencyMs: 0,
      errorCode: 'not_configured',
      lastProbedAt: new Date().toISOString(),
    };
    setProviderUpMetric(provider, 0);
    return status;
  }

  const start = Date.now();
  try {
    await adapter.complete(PROBE_INPUT);
    const latencyMs = Date.now() - start;
    const status: ProviderHealthStatus = {
      provider,
      configured: true,
      reachable: true,
      latencyMs,
      lastProbedAt: new Date().toISOString(),
    };
    setProviderUpMetric(provider, 1);
    recordProviderHealthMetric({ provider, success: true, latencyMs });
    return status;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorCode = classifyProviderError(err);
    const status: ProviderHealthStatus = {
      provider,
      configured: true,
      reachable: false,
      latencyMs,
      errorCode,
      lastProbedAt: new Date().toISOString(),
    };
    setProviderUpMetric(provider, 0);
    recordProviderHealthMetric({ provider, success: false, latencyMs, errorCode });
    return status;
  }
}

async function persistSnapshot(status: ProviderHealthStatus): Promise<void> {
  try {
    await getPrisma().aiProviderHealthSnapshot.create({
      data: {
        provider: status.provider,
        reachable: status.reachable,
        latencyMs: status.latencyMs,
        errorCode: status.errorCode ?? null,
      },
    });
  } catch (err) {
    getLogger().warn({ err, provider: status.provider }, 'Failed to persist provider health snapshot');
  }
}

export async function runAiProviderHealthProbes(options?: {
  persist?: boolean;
  skipNetwork?: boolean;
}): Promise<ProviderHealthStatus[]> {
  const config = getAiPlatformConfig();

  if (options?.skipNetwork || process.env.NODE_ENV === 'test') {
    const results: ProviderHealthStatus[] = ['openai', 'anthropic'].map((provider) => {
      const adapter = provider === 'openai' ? new OpenAiProvider() : new AnthropicProvider();
      const configured = adapter.isConfigured();
      return {
        provider,
        configured,
        reachable: configured,
        latencyMs: 0,
        lastProbedAt: new Date().toISOString(),
      };
    });
    for (const r of results) latestSnapshot.set(r.provider, r);
    return results;
  }

  logAiExecution('health_probe_start', { providers: ['openai', 'anthropic'] });

  const results = await Promise.all([
    probeProvider('openai'),
    probeProvider('anthropic'),
  ]);

  for (const status of results) {
    latestSnapshot.set(status.provider, status);
    if (options?.persist !== false && config.healthProbeEnabled) {
      await persistSnapshot(status);
    }
  }

  logAiExecution('health_probe_complete', {
    openai: results[0]?.reachable,
    anthropic: results[1]?.reachable,
  });

  return results;
}

export function getLatestProviderHealth(): ProviderHealthStatus[] {
  return ['openai', 'anthropic'].map(
    (p) =>
      latestSnapshot.get(p) ?? {
        provider: p,
        configured: false,
        reachable: false,
        latencyMs: 0,
        lastProbedAt: new Date(0).toISOString(),
      },
  );
}

export function startAiHealthProbeScheduler(): void {
  const config = getAiPlatformConfig();
  if (!config.healthProbeEnabled || probeTimer) return;

  void runAiProviderHealthProbes({ persist: true });

  probeTimer = setInterval(() => {
    void runAiProviderHealthProbes({ persist: true });
  }, config.healthProbeIntervalSec * 1000);
  probeTimer.unref?.();
}

export function stopAiHealthProbeScheduler(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
}

/** Reset in-memory state for tests. */
export function resetAiHealthProbeForTests(): void {
  stopAiHealthProbeScheduler();
  latestSnapshot = new Map();
}
