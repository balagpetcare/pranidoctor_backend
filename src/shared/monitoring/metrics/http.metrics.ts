import type { RequestHandler } from 'express';

import { isAuthPath, normalizeStatusCode, resolveAuthSurface } from './auth-paths.js';
import { Counter, LatencyHistogram } from './prometheus-series.js';
import { isHttpMetricsEnabled } from './monitoring-config.js';
import { isProbePath, normalizeRoutePath, statusClass } from './route-normalizer.js';
import { recordAuthFailure } from './security.metrics.js';

const HTTP_BUCKETS_SEC = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const httpRequestsTotal = new Counter();
const httpStatusTotal = new Counter();
const httpRequestDuration = new LatencyHistogram(HTTP_BUCKETS_SEC);

export type HttpRequestMetricInput = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

export function recordHttpRequest(input: HttpRequestMetricInput): void {
  if (!isHttpMetricsEnabled()) return;

  const route = normalizeRoutePath(input.path);
  const method = input.method.toUpperCase();
  const status = statusClass(input.statusCode);

  const statusCode = normalizeStatusCode(input.statusCode);

  httpRequestsTotal.inc({ method, route, status_class: status });
  httpStatusTotal.inc({ method, route, status_code: statusCode });
  httpRequestDuration.observe({ method, route, status_class: status }, input.durationMs / 1000);

  if (input.statusCode === 401 && isAuthPath(input.path)) {
    recordAuthFailure({
      surface: resolveAuthSurface(input.path),
      action: 'http_unauthorized',
      channel: resolveAuthSurface(input.path),
    });
  }
}

export function createHttpMetricsMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (!isHttpMetricsEnabled() || isProbePath(req.path)) {
      next();
      return;
    }

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      recordHttpRequest({
        method: req.method,
        path: req.path || req.url || '/',
        statusCode: res.statusCode,
        durationMs,
      });
    });

    next();
  };
}

export function renderHttpPrometheusLines(): string[] {
  return [
    ...httpRequestsTotal.entries(
      'pranidoctor_http_requests_total',
      'Total HTTP requests by method, route, and status class',
    ),
    ...httpStatusTotal.entries(
      'pranidoctor_http_status_total',
      'HTTP responses by method, route, and status code',
    ),
    ...httpRequestDuration.entries(
      'pranidoctor_http_request_duration_seconds',
      'HTTP request latency in seconds',
    ),
  ];
}

export function resetHttpMetricsForTests(): void {
  httpRequestsTotal.clear();
  httpStatusTotal.clear();
  httpRequestDuration.clear();
}
