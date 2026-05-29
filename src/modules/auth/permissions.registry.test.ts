import { describe, expect, it } from 'vitest';

import { UserRole } from '../../generated/prisma/index.js';

import {
  adminCan,
  getAdminCapabilityMatrix,
  type ServiceInstanceAdminCapability,
} from './permissions.registry.js';

const superAdminActor = {
  id: 'u-sa',
  email: 'sa@pranidoctor.com',
  displayName: 'Super',
  role: UserRole.SUPER_ADMIN,
};

const supportActor = {
  id: 'u-support',
  email: 'support@pranidoctor.com',
  displayName: null,
  role: UserRole.SUPPORT,
};

describe('permissions.registry', () => {
  it('SUPER_ADMIN can publish service instances', () => {
    expect(adminCan(superAdminActor, 'serviceInstance.publish')).toBe(true);
  });

  it('SUPPORT can view but not publish', () => {
    expect(adminCan(supportActor, 'serviceInstance.view')).toBe(true);
    expect(adminCan(supportActor, 'serviceInstance.review')).toBe(false);
    expect(adminCan(supportActor, 'serviceInstance.publish')).toBe(false);
  });

  it('matrix matches frozen role capabilities', () => {
    const matrix = getAdminCapabilityMatrix();
    const caps = (role: UserRole): ServiceInstanceAdminCapability[] => {
      const row = matrix[role];
      if (!row) return [];
      return Object.keys(row) as ServiceInstanceAdminCapability[];
    };
    expect(caps(UserRole.SUPER_ADMIN).sort()).toEqual(
      [
        'analytics.export',
        'analytics.view',
        'serviceInstance.publish',
        'serviceInstance.review',
        'serviceInstance.view',
      ].sort(),
    );
    expect(caps(UserRole.SUPPORT).sort()).toEqual(
      ['analytics.view', 'serviceInstance.view'].sort(),
    );
    expect(adminCan(supportActor, 'analytics.view')).toBe(true);
    expect(adminCan(supportActor, 'analytics.export')).toBe(false);
    expect(caps(UserRole.DOCTOR)).toEqual([]);
  });
});
