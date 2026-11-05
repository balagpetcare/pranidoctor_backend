import { lookup } from 'node:dns/promises';

import { getAiPlatformConfig } from '../config/ai.config.js';
import { getProviderRuntimeConfig } from '../providers/provider-config.js';
import { ensureAiProvidersBootstrapped } from '../providers/provider-factory.js';
import { getAiProviderRegistry } from '../providers/provider-registry.js';
import { REGISTRY_PROVIDER_KEYS } from '../providers/orchestrator-bridge.js';
import { getAiSecretService } from '../vault/ai-secret.service.js';
import { isPlaceholderCiphertext } from '../vault/placeholder-secret.util.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { PLATFORM_SCOPE_KEY } from '../vault/ai-secret.service.js';
import { AiApiKeyStatus } from '../../../generated/prisma/index.js';

import { AI_HEALTH_PROBE_TIMEOUT_MS, AI_PROVIDER_FETCH_TIMEOUT_MS } from './ai-health.constants.js';
import type { ProviderHealthStatus } from './ai-health-probe.service.js';

export type ProviderKeyDiagnostics = {
  provider: string;
  vaultRowPresent: boolean;
  vaultPlaceholder: boolean;
  configured: boolean;
  endpoint: string;
  probeTimeoutMs: number;
  chatModel: string;
};

export type DnsDiagnostics = {
  host: string;
  resolved: boolean;
  addresses?: string[];
  error?: string;
  latencyMs: number;
};

export type AiProviderDiagnosticsReport = {
  generatedAt: string;
  summary: {
    totalProviders: number;
    skippedNoKey: number;
    configuredWithRealKey: number;
    reachable: number;
    unreachable: number;
  };
  platform: {
    healthProbeEnabled: boolean;
    healthProbeIntervalSec: number;
    vaultMasterKeyConfigured: boolean;
    defaultFetchTimeoutMs: number;
    healthProbeTimeoutMs: number;
  };
  providers: Array<
    ProviderHealthStatus & {
      endpoint: string;
      probeTimeoutMs: number;
      chatModel: string;
      dns?: DnsDiagnostics;
      keyDiagnostics: ProviderKeyDiagnostics;
    }
  >;
};

async function resolveDnsForEndpoint(baseUrl: string): Promise<DnsDiagnostics> {
  const start = Date.now();
  let host = 'unknown';
  try {
    host = new URL(baseUrl).hostname;
    const records = await lookup(host, { all: true });
    return {
      host,
      resolved: true,
      addresses: records.map((r) => r.address),
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      host,
      resolved: false,
      error: error instanceof Error ? error.message : 'DNS lookup failed',
      latencyMs: Date.now() - start,
    };
  }
}

export async function collectProviderKeyDiagnostics(): Promise<ProviderKeyDiagnostics[]> {
  const prisma = getPrisma();
  const scopeKey = PLATFORM_SCOPE_KEY;
  const rows = await prisma.aiApiKey.findMany({
    where: {
      scopeKey,
      status: AiApiKeyStatus.ACTIVE,
      isPrimary: true,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      encryptedSecret: true,
      provider: { select: { providerKey: true } },
    },
  });

  const byProvider = new Map<string, { row: boolean; placeholder: boolean }>();
  for (const row of rows) {
    byProvider.set(row.provider.providerKey, {
      row: true,
      placeholder: isPlaceholderCiphertext(row.encryptedSecret),
    });
  }

  await getAiSecretService().refreshConfigurationCache();

  return [...REGISTRY_PROVIDER_KEYS].map((key) => {
    const meta = byProvider.get(key);
    const config = getProviderRuntimeConfig(key);
    return {
      provider: key.replace(/_/g, '-'),
      vaultRowPresent: Boolean(meta?.row),
      vaultPlaceholder: meta?.placeholder ?? false,
      configured: getAiSecretService().isProviderConfigured(key),
      endpoint: config.baseUrl,
      probeTimeoutMs: AI_HEALTH_PROBE_TIMEOUT_MS,
      chatModel: config.chatModel,
    };
  });
}

export async function buildAiProviderDiagnosticsReport(
  probeResults: ProviderHealthStatus[],
): Promise<AiProviderDiagnosticsReport> {
  const keyDiagnostics = await collectProviderKeyDiagnostics();
  const keyByProvider = new Map(keyDiagnostics.map((k) => [k.provider, k]));

  const platform = getAiPlatformConfig();
  const enriched = await Promise.all(
    probeResults.map(async (probe) => {
      const registryKey = probe.provider.replace(/-/g, '_') as (typeof REGISTRY_PROVIDER_KEYS)[number];
      let endpoint = '';
      let chatModel = '';
      let probeTimeoutMs = AI_HEALTH_PROBE_TIMEOUT_MS;
      try {
        const config = getProviderRuntimeConfig(registryKey);
        endpoint = config.baseUrl;
        chatModel = config.chatModel;
      } catch {
        endpoint = '(unknown)';
      }

      const dns =
        probe.configured && !probe.skipped
          ? await resolveDnsForEndpoint(endpoint)
          : undefined;

      return {
        ...probe,
        endpoint,
        probeTimeoutMs,
        chatModel,
        ...(dns ? { dns } : {}),
        keyDiagnostics: keyByProvider.get(probe.provider) ?? {
          provider: probe.provider,
          vaultRowPresent: false,
          vaultPlaceholder: false,
          configured: probe.configured,
          endpoint,
          probeTimeoutMs,
          chatModel,
        },
      };
    }),
  );

  const configured = enriched.filter((p) => p.configured);
  const reachable = configured.filter((p) => p.reachable);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalProviders: enriched.length,
      skippedNoKey: enriched.filter((p) => !p.configured || p.skipped).length,
      configuredWithRealKey: configured.length,
      reachable: reachable.length,
      unreachable: configured.length - reachable.length,
    },
    platform: {
      healthProbeEnabled: platform.healthProbeEnabled,
      healthProbeIntervalSec: platform.healthProbeIntervalSec,
      vaultMasterKeyConfigured: platform.vaultMasterKeyConfigured,
      defaultFetchTimeoutMs: AI_PROVIDER_FETCH_TIMEOUT_MS,
      healthProbeTimeoutMs: AI_HEALTH_PROBE_TIMEOUT_MS,
    },
    providers: enriched,
  };
}

/** Lightweight DNS-only check (no API key). */
export async function probeProviderEndpointsDns(): Promise<DnsDiagnostics[]> {
  ensureAiProvidersBootstrapped();
  const registry = getAiProviderRegistry();
  const out: DnsDiagnostics[] = [];
  for (const provider of registry.list()) {
    const config = getProviderRuntimeConfig(provider.key);
    out.push(await resolveDnsForEndpoint(config.baseUrl));
  }
  return out;
}

