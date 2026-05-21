import { describe, expect, it } from 'vitest';

import { UserRole, UserStatus } from '../../generated/prisma/index.js';

import {
  AUTH_CHANNELS,
  isCustomerRole,
  isPanelAdminRole,
  isUserActive,
  normalizeBdMobilePhone,
} from './identity-core.js';

describe('identity-core', () => {
  it('normalizes Bangladesh mobile', () => {
    expect(normalizeBdMobilePhone('01712345678')).toBe('8801712345678');
  });

  it('classifies panel admin roles', () => {
    expect(isPanelAdminRole(UserRole.ADMIN)).toBe(true);
    expect(isPanelAdminRole(UserRole.DOCTOR)).toBe(false);
  });

  it('exposes frozen auth channels', () => {
    expect(AUTH_CHANNELS.mobile).toBe('mobile');
    expect(isUserActive(UserStatus.ACTIVE)).toBe(true);
    expect(isCustomerRole(UserRole.CUSTOMER)).toBe(true);
  });
});
