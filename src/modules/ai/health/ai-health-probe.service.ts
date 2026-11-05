import { getPrisma } from '../../../shared/database/prisma.js';
import { getLogger } from '../../../shared/logger/logger.js';
import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import { getAiPlatformConfig } from '../config/ai.config.js';
import { classifyProviderError } from '../usage/ai-usage.errors.js';
import {
  recordProviderHealthMetric,
  setProviderUpMetric,
} from '../usage/ai-usage.metrics.js';
import { ensureAiProvidersBootstrapped } from '../providers/provider-factory.js';
import { getProviderRuntimeConfig } from '../providers/provider-config.js';
import { getAiProviderRegistry } from '../providers/provider-registry.js';
import { REGISTRY_PROVIDER_KEYS } from '../providers/orchestrator-bridge.js';
import type { AiProviderKey } from '../providers/core/ai-provider.types.js';

import { AI_HEALTH_PROBE_TIMEOUT_MS } from './ai-health.constants.js';

export type ProviderHealthStatus = {
  provider: string;
  configured: boolean;
  reachable: boolean;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  lastProbedAt: string;
  endpoint?: string;
  probeTimeoutMs?: number;
  skipped?: boolean;
};

let latestSnapshot: Map<string, ProviderHealthStatus> = new Map();
let probeTimer: ReturnType<typeof setInterval> | null = null;

function normalizeRegistryKey(providerKey: string): AiProviderKey {
  return providerKey.replace(/-/g, '_') as AiProviderKey;
}

function toDisplayKey(providerKey: string): string {
  return providerKey.replace(/_/g, '-');
}

async function probeProvider(providerKey: string): Promise<ProviderHealthStatus> {
  const displayKey = toDisplayKey(providerKey);
  const probedAt = new Date().toISOString();
  let endpoint = '';
  let probeTimeoutMs = AI_HEALTH_PROBE_TIMEOUT_MS;

  try {
    const config = getProviderRuntimeConfig(normalizeRegistryKey(providerKey));
    endpoint = config.baseUrl;
  } catch {
    endpoint = '(unknown)';
  }

  ensureAiProvidersBootstrapped();

  let provider;
  try {
    provider = getAiProviderRegistry().getOrThrow(normalizeRegistryKey(providerKey));
  } catch {
    const status: ProviderHealthStatus = {
      provider: displayKey,
      configured: false,
      reachable: false,
      latencyMs: 0,
      errorCode: 'not_registered',
      errorMessage: 'Provider not registered in factory',
      lastProbedAt: probedAt,
      endpoint,
      probeTimeoutMs,
      skipped: true,
    };
    setProviderUpMetric(displayKey, 0);
    return status;
  }

  const configured = provider.isConfigured();

  if (!configured) {
    const status: ProviderHealthStatus = {
      provider: displayKey,
      configured: false,
      reachable: false,
      latencyMs: 0,
      errorCode: 'not_configured',
      errorMessage: 'No usable vault API key — skipped network probe',
      lastProbedAt: probedAt,
      endpoint,
      probeTimeoutMs,
      skipped: true,
    };
    setProviderUpMetric(displayKey, 0);
    return status;
  }

  const start = Date.now();
  try {
    const health = await provider.healthCheck();
    const latencyMs = health.latencyMs ?? Date.now() - start;
    const status: ProviderHealthStatus = {
      provider: displayKey,
      configured: true,
      reachable: health.reachable,
      latencyMs,
      lastProbedAt: probedAt,
      endpoint,
      probeTimeoutMs,
      skipped: false,
      ...(health.reachable
        ? {}
        : {
            errorCode: health.errorCode ?? 'probe_failed',
            ...(health.message ? { errorMessage: health.message } : {}),
          }),
    };
    setProviderUpMetric(displayKey, health.reachable ? 1 : 0);
    recordProviderHealthMetric({
      provider: displayKey,
      success: health.reachable,
      latencyMs,
      ...(status.errorCode ? { errorCode: status.errorCode } : {}),
    });
    return status;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorCode = classifyProviderError(err);
    const errorMessage = err instanceof Error ? err.message : 'Health probe failed';
    const status: ProviderHealthStatus = {
      provider: displayKey,
      configured: true,
      reachable: false,
      latencyMs,
      errorCode,
      errorMessage,
      lastProbedAt: probedAt,
      endpoint,
      probeTimeoutMs,
      skipped: false,
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

  try {
    const { getAiSecretService } = await import('../vault/ai-secret.service.js');
    await getAiSecretService().refreshConfigurationCache();
  } catch (err) {
    getLogger().warn(
      { err: err instanceof Error ? err.message : err },
      'AI provider vault cache refresh failed — probes use last cache',
    );
  }

  if (options?.skipNetwork || process.env.NODE_ENV === 'test') {
    const results: ProviderHealthStatus[] = [...REGISTRY_PROVIDER_KEYS].map((providerKey) => {
      ensureAiProvidersBootstrapped();
      let configured = false;
      try {
        configured = getAiProviderRegistry()
          .getOrThrow(normalizeRegistryKey(providerKey))
          .isConfigured();
      } catch {
        configured = false;
      }
      const provider = toDisplayKey(providerKey);
      return {
        provider,
        configured,
        reachable: configured,
        latencyMs: 0,
        lastProbedAt: new Date().toISOString(),
        skipped: !configured,
      };
    });
    for (const r of results) latestSnapshot.set(r.provider, r);
    return results;
  }

  logAiExecution('health_probe_start', { providers: [...REGISTRY_PROVIDER_KEYS] });

  const results: ProviderHealthStatus[] = [];
  for (const key of REGISTRY_PROVIDER_KEYS) {
    try {
      results.push(await probeProvider(key));
    } catch (err) {
      const displayKey = toDisplayKey(key);
      results.push({
        provider: displayKey,
        configured: false,
        reachable: false,
        latencyMs: 0,
        errorCode: 'probe_exception',
        errorMessage: err instanceof Error ? err.message : 'Probe threw unexpectedly',
        lastProbedAt: new Date().toISOString(),
        skipped: true,
      });
    }
  }

  for (const status of results) {
    latestSnapshot.set(status.provider, status);
    if (options?.persist !== false && config.healthProbeEnabled) {
      await persistSnapshot(status).catch(() => {
        /* logged in persistSnapshot */
      });
    }
  }

  const configured = results.filter((r) => r.configured);
  logAiExecution('health_probe_complete', {
    reachable: results.filter((r) => r.reachable).length,
    configured: configured.length,
    skipped: results.filter((r) => r.skipped).length,
    total: results.length,
  });

  return results;
}

export function getLatestProviderHealth(): ProviderHealthStatus[] {
  return [...REGISTRY_PROVIDER_KEYS].map((key) => {
    const provider = toDisplayKey(key);
    return (
      latestSnapshot.get(provider) ?? {
        provider,
        configured: false,
        reachable: false,
        latencyMs: 0,
        lastProbedAt: new Date(0).toISOString(),
        skipped: true,
        errorCode: 'not_probed',
        errorMessage: 'No probe run yet',
      }
    );
  });
}

export function startAiHealthProbeScheduler(): void {
  const config = getAiPlatformConfig();
  if (!config.healthProbeEnabled || probeTimer) return;

  void runAiProviderHealthProbes({ persist: true }).catch((err) => {
    getLogger().warn(
      { err: err instanceof Error ? err.message : err },
      'Initial AI provider health probe failed (non-fatal)',
    );
  });

  probeTimer = setInterval(() => {
    void runAiProviderHealthProbes({ persist: true }).catch((err) => {
      getLogger().warn(
        { err: err instanceof Error ? err.message : err },
        'Scheduled AI provider health probe failed (non-fatal)',
      );
    });
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
