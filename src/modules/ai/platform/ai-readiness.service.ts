import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { probeRedisHealth } from '../../../infra/redis/redis.health.js';
import { getConfig } from '../../../shared/config/config.loader.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getAiPlatformConfig, validateAiSecrets } from '../config/ai.config.js';
import { getLatestProviderHealth, runAiProviderHealthProbes } from '../health/ai-health-probe.service.js';
import { getAiSettingsService } from '../settings/ai-settings.service.js';
import { getAiFoundationService } from '../foundation/ai-foundation.service.js';
import { getEncryptionService } from '../vault/encryption.service.js';

export type ReadinessGate = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
};

export type AiReadinessReport = {
  score: number;
  gates: ReadinessGate[];
  checkedAt: string;
};

const REQUIRED_AI_MIGRATIONS = [
  '20260603120000_ai_management_foundation',
  '20260603140000_ai_vault_audit_log',
  '20260604120000_ai_marketplace_extensions',
  '20260605120000_ai_core_platform_phase1',
  '20260606120000_ai_phase2_provider_management',
  '20260607120000_ai_phase3_model_registry',
  '20260608120000_ai_phase4_router_engine',
];

function gateScore(gates: ReadinessGate[]): number {
  if (gates.length === 0) return 0;
  const pass = gates.filter((g) => g.status === 'pass').length;
  const warn = gates.filter((g) => g.status === 'warn').length;
  return Math.round(((pass + warn * 0.5) / gates.length) * 100);
}

function aiLlmRequiredInProd(config: ReturnType<typeof getConfig>): boolean {
  return config.nodeEnv === 'production' && process.env.AI_LLM_REQUIRED === 'true';
}

export class AiReadinessService {
  readonly name = 'AiReadinessService';

  async checkAll(options?: { liveProviderProbe?: boolean }): Promise<AiReadinessReport> {
    const gates: ReadinessGate[] = [];
    const config = getConfig();

    try {
      const redis = await probeRedisHealth(config);
      gates.push({
        id: 'redis',
        label: 'Redis',
        status: redis.healthy ? 'pass' : config.nodeEnv === 'production' ? 'fail' : 'warn',
        message: redis.error ?? (redis.healthy ? 'Redis reachable' : 'Redis unavailable'),
      });
    } catch (error) {
      gates.push({
        id: 'redis',
        label: 'Redis',
        status: config.nodeEnv === 'production' ? 'fail' : 'warn',
        message: error instanceof Error ? error.message : 'Redis check failed',
      });
    }

    gates.push({
      id: 'vault_master_key',
      label: 'Vault master key',
      status: getEncryptionService().isMasterKeyConfigured() ? 'pass' : 'fail',
      message: getEncryptionService().isMasterKeyConfigured()
        ? 'AI_VAULT_MASTER_KEY configured'
        : 'AI_VAULT_MASTER_KEY missing',
    });

    try {
      const aiConfig = getAiPlatformConfig();
      await validateAiSecrets(aiConfig);
      gates.push({
        id: 'llm_secrets',
        label: 'LLM API keys',
        status: 'pass',
        message: 'At least one active provider key in vault',
      });
    } catch (error) {
      gates.push({
        id: 'llm_secrets',
        label: 'LLM API keys',
        status: aiLlmRequiredInProd(config) ? 'fail' : 'warn',
        message: error instanceof Error ? error.message : 'Vault keys missing',
      });
    }

    try {
      const applied = await getPrisma().$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
      `;
      const names = new Set(applied.map((r) => r.migration_name));
      const missing = REQUIRED_AI_MIGRATIONS.filter((m) => !names.has(m));
      gates.push({
        id: 'migrations',
        label: 'AI migrations',
        status: missing.length === 0 ? 'pass' : 'fail',
        message:
          missing.length === 0
            ? 'Required AI migrations applied'
            : `Missing migrations: ${missing.join(', ')}`,
      });
    } catch (error) {
      gates.push({
        id: 'migrations',
        label: 'AI migrations',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Could not verify migrations',
      });
    }

    try {
      const settings = await getAiSettingsService().getSnapshot();
      gates.push({
        id: 'ai_settings',
        label: 'AI settings registry',
        status: settings.resolvedFrom === 'environment' ? 'warn' : 'pass',
        message:
          settings.resolvedFrom === 'environment'
            ? 'Using env defaults — seed ai_settings for production'
            : `Settings loaded from ${settings.resolvedFrom}`,
      });
    } catch (error) {
      gates.push({
        id: 'ai_settings',
        label: 'AI settings registry',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Settings check failed',
      });
    }

    try {
      const foundation = await getAiFoundationService().getStatus();
      gates.push({
        id: 'ai_foundation',
        label: 'AI foundation registry',
        status: foundation.providerCount > 0 && foundation.routeCount > 0 ? 'pass' : 'warn',
        message: `${foundation.providerCount} providers, ${foundation.routeCount} routes in registry`,
      });
    } catch (error) {
      gates.push({
        id: 'ai_foundation',
        label: 'AI foundation registry',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Foundation check failed',
      });
    }

    const buildMarker = join(process.cwd(), 'dist', 'server.js');
    gates.push({
      id: 'build',
      label: 'Backend build',
      status: existsSync(buildMarker) ? 'pass' : 'warn',
      message: existsSync(buildMarker) ? 'dist/server.js present' : 'Build artifact not found (dev mode OK)',
    });

    if (options?.liveProviderProbe && process.env.NODE_ENV !== 'test') {
      await runAiProviderHealthProbes({ persist: false });
    }
    const health = getLatestProviderHealth();
    const configured = health.filter((h) => h.configured);
    const reachable = configured.filter((h) => h.reachable);
    gates.push({
      id: 'provider_health',
      label: 'Provider connectivity',
      status: reachable.length > 0 ? 'pass' : configured.length > 0 ? 'warn' : 'fail',
      message: `${reachable.length}/${configured.length || health.length} configured providers reachable`,
    });

    return {
      score: gateScore(gates),
      gates,
      checkedAt: new Date().toISOString(),
    };
  }
}

let service: AiReadinessService | null = null;

export function getAiReadinessService(): AiReadinessService {
  if (!service) service = new AiReadinessService();
  return service;
}

export function resetAiReadinessServiceForTests(): void {
  service = null;
}
