import { describe, expect, it } from 'vitest';

import { UserRole, UserStatus } from '../../../generated/prisma/index.js';

import {
  assertUserCanAuthenticate,
  roleAllowsMobileAccess,
  roleAllowsPanelAccess,
  toRoleSlug,
} from './role.guard.js';

describe('role.guard', () => {
  it('maps Prisma roles to identity slugs', () => {
    expect(toRoleSlug(UserRole.CUSTOMER)).toBe('farmer');
    expect(toRoleSlug(UserRole.DOCTOR)).toBe('doctor');
    expect(toRoleSlug(UserRole.AI_TECHNICIAN)).toBe('ai_technician');
    expect(toRoleSlug(UserRole.ADMIN)).toBe('admin');
    expect(toRoleSlug(UserRole.SUPER_ADMIN)).toBe('super_admin');
  });

  it('checks panel and mobile access boundaries', () => {
    expect(roleAllowsPanelAccess(UserRole.ADMIN)).toBe(true);
    expect(roleAllowsPanelAccess(UserRole.DOCTOR)).toBe(true);
    expect(roleAllowsPanelAccess(UserRole.CUSTOMER)).toBe(false);
    expect(roleAllowsMobileAccess(UserRole.CUSTOMER)).toBe(true);
    expect(roleAllowsMobileAccess(UserRole.DOCTOR)).toBe(false);
  });

  it('allows authentication only for active users', () => {
    expect(assertUserCanAuthenticate(UserStatus.ACTIVE)).toBe(true);
    expect(assertUserCanAuthenticate(UserStatus.SUSPENDED)).toBe(false);
  });
});
