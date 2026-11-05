import { afterEach, describe, expect, it } from 'vitest';

import {
  filterDemoSampleRows,
  getMonitoringScopeMeta,
} from './monitoring-scope.js';
import {
  getMonitoringExcludeIdPrefixes,
  getMonitoringMaxRecordAgeDays,
  shouldDeliverMonitoringAlerts,
} from './escalation-config.js';

describe('monitoring-scope', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('filters uaseed sample rows', () => {
    const rows = filterDemoSampleRows([
      { id: 'uaseed-v1-appt-0001' },
      { id: 'clxyz123' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('clxyz123');
  });

  it('defaults exclude prefixes include uaseed', () => {
    delete process.env['MONITORING_EXCLUDE_ID_PREFIXES'];
    expect(getMonitoringExcludeIdPrefixes()).toContain('uaseed-');
  });

  it('uses shorter max record age in non-production', () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['OPS_MONITORING_MAX_RECORD_AGE_DAYS'];
    expect(getMonitoringMaxRecordAgeDays()).toBe(14);
  });

  it('suppresses alert delivery in development by default', () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['MONITORING_ALERTS_IN_DEV'];
    expect(shouldDeliverMonitoringAlerts()).toBe(false);
  });

  it('delivers alerts in production', () => {
    process.env['NODE_ENV'] = 'production';
    expect(shouldDeliverMonitoringAlerts()).toBe(true);
  });

  it('exposes monitoring scope meta', () => {
    process.env['NODE_ENV'] = 'development';
    const meta = getMonitoringScopeMeta();
    expect(meta.demoIdExclusion).toBe(true);
    expect(meta.maxRecordAgeDays).toBeGreaterThan(0);
  });
});
