import { getPrisma } from '../../../shared/database/prisma.js';
import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import type { AiProviderKey } from '../providers/core/ai-provider.types.js';
import { ensureAiProvidersBootstrapped, getAiProviderRegistry } from '../providers/index.js';
import type { ProviderHealthSnapshot } from './failover.types.js';
import { getAIProviderMonitor } from './ai-provider-monitor.js';

export class AIHealthService {
  readonly name = 'AIHealthService';

  private readonly monitor = getAIProviderMonitor();

  async checkProvider(providerKey: string): Promise<ProviderHealthSnapshot> {
    if (providerKey === 'rules-based') {
      const snapshot: ProviderHealthSnapshot = {
        providerKey,
        configured: true,
        reachable: true,
        latencyMs: 0,
        circuitState: 'closed',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        healthScore: 1,
        lastCheckedAt: new Date().toISOString(),
      };
      this.monitor.applyHealthSnapshot(snapshot);
      return snapshot;
    }

    ensureAiProvidersBootstrapped();
    const provider = getAiProviderRegistry().get(providerKey as AiProviderKey);
    if (!provider) {
      const snapshot: ProviderHealthSnapshot = {
        providerKey,
        configured: false,
        reachable: false,
        latencyMs: 0,
        circuitState: this.monitor.getCircuitState(providerKey),
        consecutiveFailures: this.monitor.getConsecutiveFailures(providerKey),
        consecutiveSuccesses: 0,
        healthScore: 0,
        errorCode: 'unknown_provider',
        lastCheckedAt: new Date().toISOString(),
      };
      this.monitor.applyHealthSnapshot(snapshot);
      return snapshot;
    }

    const health = await provider.healthCheck();
    const snapshot: ProviderHealthSnapshot = {
      providerKey,
      configured: health.configured,
      reachable: health.reachable,
      latencyMs: health.latencyMs,
      circuitState: this.monitor.getCircuitState(providerKey),
      consecutiveFailures: this.monitor.getConsecutiveFailures(providerKey),
      consecutiveSuccesses: 0,
      healthScore: health.reachable ? 1 : health.configured ? 0.3 : 0,
      lastCheckedAt: new Date().toISOString(),
    };
    if (health.errorCode) snapshot.errorCode = health.errorCode;

    this.monitor.applyHealthSnapshot(snapshot);
    await this.persistProviderHealth(providerKey, snapshot);

    logAiExecution('ai_health_probe', {
      providerKey,
      reachable: snapshot.reachable,
      latencyMs: snapshot.latencyMs,
    });

    return snapshot;
  }

  async checkAll(providerKeys?: string[]): Promise<ProviderHealthSnapshot[]> {
    ensureAiProvidersBootstrapped();
    const keys =
      providerKeys ??
      getAiProviderRegistry()
        .list()
        .map((provider) => provider.key);

    const results: ProviderHealthSnapshot[] = [];
    for (const key of keys) {
      results.push(await this.checkProvider(key));
    }
    return results;
  }

  getSnapshot(providerKey: string): ProviderHealthSnapshot | undefined {
    return this.monitor.getSnapshot(providerKey);
  }

  getAllSnapshots(): ProviderHealthSnapshot[] {
    return this.monitor.getAllSnapshots();
  }

  isProviderHealthy(providerKey: string): boolean {
    return this.monitor.isProviderHealthy(providerKey);
  }

  private async persistProviderHealth(
    providerKey: string,
    snapshot: ProviderHealthSnapshot,
  ): Promise<void> {
    try {
      await getPrisma().aiProvider.updateMany({
        where: { providerKey, deletedAt: null },
        data: {
          healthScore: snapshot.healthScore,
          lastHealthCheckAt: new Date(snapshot.lastCheckedAt),
        },
      });
    } catch {
      // Non-blocking — health still tracked in memory.
    }
  }
}

let aiHealthService: AIHealthService | null = null;

export function getAIHealthService(): AIHealthService {
  if (!aiHealthService) aiHealthService = new AIHealthService();
  return aiHealthService;
}

export function resetAIHealthServiceForTests(): void {
  aiHealthService = null;
}
