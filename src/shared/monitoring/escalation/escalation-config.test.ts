import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  getDoctorAcceptEmergencyMaxMinutes,
  getEmergencyUnassignedMaxMinutes,
  getEscalationCheckIntervalMs,
  getRejectionSpikeRateThreshold,
  isEscalationMonitoringEnabled,
} from './escalation-config.js';

describe('escalation-config', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('defaults monitoring enabled when MONITORING_ENABLED unset', () => {
    delete process.env['ESCALATION_MONITORING_ENABLED'];
    delete process.env['MONITORING_ENABLED'];
    expect(isEscalationMonitoringEnabled()).toBe(true);
  });

  it('respects ESCALATION_MONITORING_ENABLED=false', () => {
    process.env['ESCALATION_MONITORING_ENABLED'] = 'false';
    expect(isEscalationMonitoringEnabled()).toBe(false);
  });

  it('uses configurable SLA thresholds', () => {
    process.env['OPS_EMERGENCY_UNASSIGNED_MINUTES'] = '20';
    process.env['OPS_DOCTOR_ACCEPT_EMERGENCY_MINUTES'] = '25';
    process.env['OPS_REJECTION_SPIKE_RATE'] = '0.35';
    process.env['ESCALATION_CHECK_INTERVAL_MS'] = '120000';

    expect(getEmergencyUnassignedMaxMinutes()).toBe(20);
    expect(getDoctorAcceptEmergencyMaxMinutes()).toBe(25);
    expect(getRejectionSpikeRateThreshold()).toBe(0.35);
    expect(getEscalationCheckIntervalMs()).toBe(120_000);
  });
});
