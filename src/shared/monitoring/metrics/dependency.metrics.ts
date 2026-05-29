import { Gauge } from './prometheus-series.js';

const dbUp = new Gauge();
const redisUp = new Gauge();
const ready = new Gauge();
const dbProbeLatencyMs = new Gauge();
const redisProbeLatencyMs = new Gauge();

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

export function renderDependencyPrometheusLines(): string[] {
  return [
    ...dbUp.entries('pranidoctor_db_up', 'Database connectivity (1=up, 0=down)'),
    ...redisUp.entries('pranidoctor_redis_up', 'Redis connectivity (1=up, 0=down)'),
    ...ready.entries('pranidoctor_ready', 'Readiness aggregate (1=ready, 0=not ready)'),
    ...dbProbeLatencyMs.entries(
      'pranidoctor_db_probe_latency_ms',
      'Last database probe latency in milliseconds',
    ),
    ...redisProbeLatencyMs.entries(
      'pranidoctor_redis_probe_latency_ms',
      'Last Redis probe latency in milliseconds',
    ),
  ];
}

export function resetDependencyMetricsForTests(): void {
  dbUp.clear();
  redisUp.clear();
  ready.clear();
  dbProbeLatencyMs.clear();
  redisProbeLatencyMs.clear();
}
