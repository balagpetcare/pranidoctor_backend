import { describe, expect, it, beforeEach } from 'vitest';

import { recordDbQuery, renderDbPrometheusLines, resetDbMetricsForTests } from './db.metrics.js';
import { recordHttpRequest, renderHttpPrometheusLines, resetHttpMetricsForTests } from './http.metrics.js';
import { parsePrismaQueryLabels } from './prisma-query-labels.js';
import { normalizeRoutePath, statusClass } from './route-normalizer.js';

describe('route-normalizer', () => {
  it('collapses uuid path segments', () => {
    expect(
      normalizeRoutePath('/api/mobile/livestock/550e8400-e29b-41d4-a716-446655440000/weight'),
    ).toBe('/api/mobile/livestock/:id/weight');
  });

  it('collapses numeric ids', () => {
    expect(normalizeRoutePath('/api/admin/users/42')).toBe('/api/admin/users/:id');
  });

  it('maps status classes', () => {
    expect(statusClass(200)).toBe('2xx');
    expect(statusClass(404)).toBe('4xx');
    expect(statusClass(503)).toBe('5xx');
  });
});

describe('http metrics', () => {
  beforeEach(() => {
    process.env['METRICS_ENABLED'] = 'true';
    process.env['HTTP_METRICS_ENABLED'] = 'true';
    resetHttpMetricsForTests();
  });

  it('exports request counters, status codes, and histograms', () => {
    recordHttpRequest({
      method: 'GET',
      path: '/api/mobile/feeds',
      statusCode: 200,
      durationMs: 42,
    });
    recordHttpRequest({
      method: 'GET',
      path: '/api/mobile/feeds',
      statusCode: 500,
      durationMs: 120,
    });
    recordHttpRequest({
      method: 'POST',
      path: '/api/mobile/auth/otp/verify',
      statusCode: 401,
      durationMs: 10,
    });

    const text = renderHttpPrometheusLines().join('\n');
    expect(text).toContain('pranidoctor_http_requests_total');
    expect(text).toContain('status_class="2xx"');
    expect(text).toContain('status_class="5xx"');
    expect(text).toContain('pranidoctor_http_status_total');
    expect(text).toContain('status_code="401"');
    expect(text).toContain('pranidoctor_http_request_duration_seconds_bucket');
  });
});

describe('db metrics', () => {
  beforeEach(() => {
    resetDbMetricsForTests();
  });

  it('parses prisma sql labels', () => {
    expect(parsePrismaQueryLabels('SELECT "User"."id" FROM "User" WHERE 1=1')).toEqual({
      model: 'user',
      operation: 'select',
    });
  });

  it('exports db query series', () => {
    recordDbQuery({ model: 'user', operation: 'select', durationMs: 15 });
    const text = renderDbPrometheusLines().join('\n');
    expect(text).toContain('pranidoctor_db_queries_total');
    expect(text).toContain('model="user"');
  });
});
