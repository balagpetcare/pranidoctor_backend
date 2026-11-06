import { describe, expect, it } from 'vitest';

import { ProviderStatus } from '../../generated/prisma/index.js';

import { accountStateFor, primaryRoleOf } from './partner-summary.js';

describe('partner summary helpers', () => {
  it('maps provider status to an app-facing account state', () => {
    expect(accountStateFor(null)).toBe('NOT_APPLIED');
    expect(accountStateFor(ProviderStatus.PENDING_VERIFICATION)).toBe('PENDING');
    expect(accountStateFor(ProviderStatus.ACTIVE)).toBe('APPROVED');
    expect(accountStateFor(ProviderStatus.REJECTED)).toBe('REJECTED');
    expect(accountStateFor(ProviderStatus.SUSPENDED)).toBe('SUSPENDED');
  });

  it('picks the broadest role as primary', () => {
    expect(primaryRoleOf(['HEALTH_WORKER', 'DOCTOR'])).toBe('DOCTOR');
    expect(primaryRoleOf(['HEALTH_WORKER', 'AI_TECHNICIAN'])).toBe('AI_TECHNICIAN');
    expect(primaryRoleOf([])).toBeNull();
  });
});
