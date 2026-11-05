import {
  buildAiProviderDiagnosticsReport,
} from '../../modules/ai/health/ai-provider-diagnostics.js';
import {
  getLatestProviderHealth,
  runAiProviderHealthProbes,
} from '../../modules/ai/health/ai-health-probe.service.js';

import type { HealthCheckResult } from './health.types.js';

/**
 * Live AI provider diagnostics — never throws; safe for health routes and startup.
 */
export async function checkAiProvidersHealth(options?: {
  liveProbe?: boolean;
}): Promise<HealthCheckResult & { diagnostics?: Awaited<ReturnType<typeof buildAiProviderDiagnosticsReport>> }> {
  const start = Date.now();
  try {
    let probes = getLatestProviderHealth();
    if (options?.liveProbe && process.env.NODE_ENV !== 'test') {
      probes = await runAiProviderHealthProbes({ persist: false });
    }

    const diagnostics = await buildAiProviderDiagnosticsReport(probes);
    const { summary } = diagnostics;
    const configured = summary.configuredWithRealKey;
    const reachable = summary.reachable;

    let status: HealthCheckResult['status'] = 'healthy';
    let message: string | undefined;

    if (configured === 0) {
      status = 'degraded';
      message = 'No providers with usable API keys — probes skipped';
    } else if (reachable === 0) {
      status = 'degraded';
      message = `${configured} provider(s) configured but 0 reachable — check keys, DNS, and endpoints`;
    } else {
      message = `${reachable}/${configured} configured providers reachable`;
    }

    return {
      name: 'ai-providers',
      status,
      latency: Date.now() - start,
      message,
      details: {
        summary: diagnostics.summary,
        platform: diagnostics.platform,
        providers: diagnostics.providers,
      },
      diagnostics,
    };
  } catch (error) {
    return {
      name: 'ai-providers',
      status: 'degraded',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'AI provider diagnostics failed',
    };
  }
}
