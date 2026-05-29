import { performance } from 'node:perf_hooks';

import { Gauge } from './prometheus-series.js';

const rssBytes = new Gauge();
const heapUsedBytes = new Gauge();
const heapTotalBytes = new Gauge();
const eventLoopLagMs = new Gauge();

let lastEventLoopCheck = performance.now();
let pendingLag = 0;

function scheduleEventLoopLagSample(): void {
  const expected = lastEventLoopCheck + 1000;
  lastEventLoopCheck = expected;
  setTimeout(() => {
    const drift = performance.now() - expected;
    pendingLag = Math.max(0, drift);
    scheduleEventLoopLagSample();
  }, 1000).unref();
}

scheduleEventLoopLagSample();

export function refreshResourceMetrics(): void {
  const mem = process.memoryUsage();
  rssBytes.setUnlabeled(mem.rss);
  heapUsedBytes.setUnlabeled(mem.heapUsed);
  heapTotalBytes.setUnlabeled(mem.heapTotal);
  eventLoopLagMs.setUnlabeled(Math.round(pendingLag));
}

export function renderResourcePrometheusLines(): string[] {
  refreshResourceMetrics();
  return [
    ...rssBytes.entries('pranidoctor_process_rss_bytes', 'Process resident set size in bytes'),
    ...heapUsedBytes.entries(
      'pranidoctor_process_heap_used_bytes',
      'V8 heap used in bytes',
    ),
    ...heapTotalBytes.entries(
      'pranidoctor_process_heap_total_bytes',
      'V8 heap total in bytes',
    ),
    ...eventLoopLagMs.entries(
      'pranidoctor_event_loop_lag_ms',
      'Approximate event loop lag in milliseconds',
    ),
  ];
}

export function resetResourceMetricsForTests(): void {
  rssBytes.clear();
  heapUsedBytes.clear();
  heapTotalBytes.clear();
  eventLoopLagMs.clear();
}
