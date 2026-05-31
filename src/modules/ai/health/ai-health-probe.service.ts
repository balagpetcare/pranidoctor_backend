import { getPrisma } from '../../../shared/database/prisma.js';
import { getLogger } from '../../../shared/logger/logger.js';
import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import { getAiPlatformConfig } from '../config/ai.config.js';
import { classifyProviderError } from '../usage/ai-usage.errors.js';
import {
  recordProviderHealthMetric,
  setProviderUpMetric,
} from '../usage/ai-usage.metrics.js';
import { createOrchestratorAdapterFromKey, REGISTRY_PROVIDER_KEYS } from '../providers/orchestrator-bridge.js';

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

async function probeProvider(providerKey: string): Promise<ProviderHealthStatus> {
  const displayKey = providerKey.replace(/_/g, '-');
  let adapter;
  try {
    adapter = createOrchestratorAdapterFromKey(providerKey);
  } catch {
    return {
      provider: displayKey,
      configured: false,
      reachable: false,
      latencyMs: 0,
      errorCode: 'not_registered',
      lastProbedAt: new Date().toISOString(),
    };
  }

  const configured = adapter.isConfigured();

  if (!configured) {
    const status: ProviderHealthStatus = {
      provider: displayKey,
      configured: false,
      reachable: false,
      latencyMs: 0,
      errorCode: 'not_configured',
      lastProbedAt: new Date().toISOString(),
    };
    setProviderUpMetric(displayKey, 0);
    return status;
  }

  const start = Date.now();
  try {
    await adapter.complete(PROBE_INPUT);
    const latencyMs = Date.now() - start;
    const status: ProviderHealthStatus = {
      provider: displayKey,
      configured: true,
      reachable: true,
      latencyMs,
      lastProbedAt: new Date().toISOString(),
    };
    setProviderUpMetric(displayKey, 1);
    recordProviderHealthMetric({ provider: displayKey, success: true, latencyMs });
    return status;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorCode = classifyProviderError(err);
    const status: ProviderHealthStatus = {
      provider: displayKey,
      configured: true,
      reachable: false,
      latencyMs,
      errorCode,
      lastProbedAt: new Date().toISOString(),
    };
    setProviderUpMetric(displayKey, 0);
    recordProviderHealthMetric({ provider: displayKey, success: false, latencyMs, errorCode });
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
    const results: ProviderHealthStatus[] = [...REGISTRY_PROVIDER_KEYS].map((providerKey) => {
      let configured = false;
      try {
        configured = createOrchestratorAdapterFromKey(providerKey).isConfigured();
      } catch {
        configured = false;
      }
      const provider = providerKey.replace(/_/g, '-');
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

  logAiExecution('health_probe_start', { providers: [...REGISTRY_PROVIDER_KEYS] });

  const results = await Promise.all([...REGISTRY_PROVIDER_KEYS].map((key) => probeProvider(key)));

  for (const status of results) {
    latestSnapshot.set(status.provider, status);
    if (options?.persist !== false && config.healthProbeEnabled) {
      await persistSnapshot(status);
    }
  }

  logAiExecution('health_probe_complete', {
    reachable: results.filter((r) => r.reachable).length,
    total: results.length,
  });

  return results;
}

export function getLatestProviderHealth(): ProviderHealthStatus[] {
  return [...REGISTRY_PROVIDER_KEYS].map((key) => {
    const provider = key.replace(/_/g, '-');
    return (
      latestSnapshot.get(provider) ?? {
        provider,
        configured: false,
        reachable: false,
        latencyMs: 0,
        lastProbedAt: new Date(0).toISOString(),
      }
    );
  });
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
