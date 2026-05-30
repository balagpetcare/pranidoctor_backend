import { Gauge } from './prometheus-series.js';

const dbUp = new Gauge();
const redisUp = new Gauge();
const storageUp = new Gauge();
const ready = new Gauge();
const dbProbeLatencyMs = new Gauge();
const redisProbeLatencyMs = new Gauge();
const storageProbeLatencyMs = new Gauge();

export function recordDatabaseProbe(input: { up: boolean; latencyMs: number }): void {
  dbUp.setUnlabeled(input.up ? 1 : 0);
  dbProbeLatencyMs.setUnlabeled(Math.round(input.latencyMs));
}

export function recordRedisProbe(input: { up: boolean; latencyMs: number }): void {
  redisUp.setUnlabeled(input.up ? 1 : 0);
  redisProbeLatencyMs.setUnlabeled(Math.round(input.latencyMs));
}

export function recordReadiness(isReady: boolean): void {
  ready.setUnlabeled(isReady ? 1 : 0);
}

export function recordStorageProbe(input: { up: boolean; latencyMs: number }): void {
  storageUp.setUnlabeled(input.up ? 1 : 0);
  storageProbeLatencyMs.setUnlabeled(Math.round(input.latencyMs));
}

export function renderDependencyPrometheusLines(): string[] {
  return [
    ...dbUp.entries('pranidoctor_db_up', 'Database connectivity (1=up, 0=down)'),
    ...redisUp.entries('pranidoctor_redis_up', 'Redis connectivity (1=up, 0=down)'),
    ...storageUp.entries('pranidoctor_storage_up', 'Object storage connectivity (1=up, 0=down)'),
    ...ready.entries('pranidoctor_ready', 'Readiness aggregate (1=ready, 0=not ready)'),
    ...dbProbeLatencyMs.entries(
      'pranidoctor_db_probe_latency_ms',
      'Last database probe latency in milliseconds',
    ),
    ...redisProbeLatencyMs.entries(
      'pranidoctor_redis_probe_latency_ms',
      'Last Redis probe latency in milliseconds',
    ),
    ...storageProbeLatencyMs.entries(
      'pranidoctor_storage_probe_latency_ms',
      'Last storage probe latency in milliseconds',
    ),
  ];
}

export function resetDependencyMetricsForTests(): void {
  dbUp.clear();
  redisUp.clear();
  storageUp.clear();
  ready.clear();
  dbProbeLatencyMs.clear();
  redisProbeLatencyMs.clear();
  storageProbeLatencyMs.clear();
}
