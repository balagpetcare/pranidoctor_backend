import { Counter, LatencyHistogram } from '../../../shared/monitoring/metrics/prometheus-series.js';

const requestsTotal = new Counter();
const tokensTotal = new Counter();
const costTotal = new Counter();
const fallbacksTotal = new Counter();
const latencyHistogram = new LatencyHistogram([0.1, 0.5, 1, 2, 5, 10, 30]);

let llmDisabled = 0;

export function recordAiUsageMetrics(params: {
  feature: string;
  provider: string;
  model: string;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  isFallback?: boolean;
  fromProvider?: string;
}): void {
  const status = params.success ? 'success' : 'failure';
  const base = {
    feature: params.feature,
    provider: params.provider,
    model: params.model,
  };

  requestsTotal.inc({ ...base, status });
  latencyHistogram.observe(base, params.latencyMs / 1000);

  if (params.success) {
    if (params.inputTokens > 0) {
      tokensTotal.inc({ ...base, type: 'input' }, params.inputTokens);
    }
    if (params.outputTokens > 0) {
      tokensTotal.inc({ ...base, type: 'output' }, params.outputTokens);
    }
    if (params.costUsd > 0) {
      costTotal.inc(base, params.costUsd);
    }
  }

  if (params.isFallback && params.fromProvider) {
    fallbacksTotal.inc({
      from_provider: params.fromProvider,
      to_provider: params.provider,
    });
  }
}

export function setAiLlmDisabledMetric(disabled: boolean): void {
  llmDisabled = disabled ? 1 : 0;
}

export function renderAiUsagePrometheusLines(): string[] {
  return [
    ...requestsTotal.entries('ai_requests_total', 'Total AI orchestrator attempts'),
    ...latencyHistogram.entries(
      'ai_request_duration_seconds',
      'AI request duration in seconds',
    ),
    ...tokensTotal.entries('ai_tokens_total', 'Total AI tokens'),
    ...costTotal.entries('ai_cost_usd_total', 'Estimated AI cost in USD'),
    ...fallbacksTotal.entries('ai_fallbacks_total', 'AI provider fallbacks'),
    '# HELP ai_llm_disabled LLM kill switch (1=disabled)',
    '# TYPE ai_llm_disabled gauge',
    `ai_llm_disabled ${llmDisabled}`,
  ];
}

/** Test helper — reset in-memory series. */
export function resetAiUsageMetricsForTests(): void {
  llmDisabled = 0;
  requestsTotal.clear();
  tokensTotal.clear();
  costTotal.clear();
  fallbacksTotal.clear();
  latencyHistogram.clear();
}
