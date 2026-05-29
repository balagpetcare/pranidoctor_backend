import { renderAiUsagePrometheusLines } from '../../../modules/ai/usage/ai-usage.metrics.js';
import { renderEscalationPrometheusLines } from '../escalation/escalation.metrics.js';
import { renderDbPrometheusLines, resetDbMetricsForTests } from './db.metrics.js';
import { renderDependencyPrometheusLines, resetDependencyMetricsForTests } from './dependency.metrics.js';
import { renderHttpPrometheusLines, resetHttpMetricsForTests } from './http.metrics.js';
import { renderQueuePrometheusLines, resetQueueMetricsForTests } from './queue.metrics.js';
import { renderResourcePrometheusLines, resetResourceMetricsForTests } from './resource.metrics.js';

export { createHttpMetricsMiddleware, recordHttpRequest } from './http.metrics.js';
export { recordDbQuery } from './db.metrics.js';
export { recordQueueJob } from './queue.metrics.js';
export {
  recordDatabaseProbe,
  recordReadiness,
  recordRedisProbe,
} from './dependency.metrics.js';
export { normalizeRoutePath, statusClass, isProbePath } from './route-normalizer.js';
export { getSlowQueryThresholdMs } from './monitoring-config.js';

export function renderAllPrometheusLines(): string[] {
  return [
    ...renderHttpPrometheusLines(),
    ...renderDbPrometheusLines(),
    ...renderQueuePrometheusLines(),
    ...renderDependencyPrometheusLines(),
    ...renderResourcePrometheusLines(),
    ...renderEscalationPrometheusLines(),
    ...renderAiUsagePrometheusLines(),
  ];
}

export function resetAllMetricsForTests(): void {
  resetHttpMetricsForTests();
  resetDbMetricsForTests();
  resetQueueMetricsForTests();
  resetDependencyMetricsForTests();
  resetResourceMetricsForTests();
}
