import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AI_FEE_SETTINGS,
  aiMonthlyFeeFor,
  aiPerServiceFeeFor,
} from './partner-fee-policy.js';
import {
  canProvideService,
  grantedServiceRoles,
  isPartnerRole,
  requiresOwnCredentials,
} from './partner-roles.js';
import { toGatewayNumber } from './partner-sms.js';

describe('partner role hierarchy', () => {
  it('doctor can provide all three services', () => {
    expect(grantedServiceRoles('DOCTOR')).toEqual(['DOCTOR', 'AI_TECHNICIAN', 'HEALTH_WORKER']);
  });

  it('AI technician can provide AI and health-worker services, not doctor', () => {
    expect(canProvideService('AI_TECHNICIAN', 'HEALTH_WORKER')).toBe(true);
    expect(canProvideService('AI_TECHNICIAN', 'DOCTOR')).toBe(false);
  });

  it('health worker can only provide health-worker services', () => {
    expect(grantedServiceRoles('HEALTH_WORKER')).toEqual(['HEALTH_WORKER']);
    expect(canProvideService('HEALTH_WORKER', 'AI_TECHNICIAN')).toBe(false);
  });

  it('only the primary role needs its own credentials', () => {
    expect(requiresOwnCredentials('DOCTOR', 'AI_TECHNICIAN')).toBe(false);
    expect(requiresOwnCredentials('AI_TECHNICIAN', 'HEALTH_WORKER')).toBe(false);
    expect(requiresOwnCredentials('DOCTOR', 'DOCTOR')).toBe(true);
  });

  it('rejects unknown role strings', () => {
    expect(isPartnerRole('ADMIN')).toBe(false);
    expect(isPartnerRole('DOCTOR')).toBe(true);
  });
});

describe('AI fee policy', () => {
  const s = DEFAULT_AI_FEE_SETTINGS;

  it('doctor never pays the monthly AI fee', () => {
    expect(aiMonthlyFeeFor('DOCTOR', s, 0)).toBe(0);
  });

  it('AI technician pays 1500 unless 60 services reached', () => {
    expect(aiMonthlyFeeFor('AI_TECHNICIAN', s, 59)).toBe(1500);
    expect(aiMonthlyFeeFor('AI_TECHNICIAN', s, 60)).toBe(0);
  });

  it('per-service fee is fixed 50 by default and can switch to percent', () => {
    expect(aiPerServiceFeeFor(s, 800)).toBe(50);
    expect(aiPerServiceFeeFor({ ...s, perServiceFeePercent: 10 }, 800)).toBe(80);
  });
});

describe('gateway phone format', () => {
  it('normalises Bangladeshi numbers', () => {
    expect(toGatewayNumber('01712345678')).toBe('8801712345678');
    expect(toGatewayNumber('+8801712345678')).toBe('8801712345678');
    expect(toGatewayNumber('12345')).toBeNull();
  });
});
