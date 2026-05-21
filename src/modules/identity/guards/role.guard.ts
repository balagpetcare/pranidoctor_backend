import { UserRole } from '../../../generated/prisma/index.js';
import {
  isCustomerRole,
  isDoctorRole,
  isPanelAdminRole,
  isTechnicianRole,
  isUserActive,
} from '../../auth/identity-core.js';

import type { IdentityRoleSlug } from '../identity.types.js';

const ROLE_SLUG_MAP: Record<UserRole, IdentityRoleSlug> = {
  [UserRole.CUSTOMER]: 'farmer',
  [UserRole.DOCTOR]: 'doctor',
  [UserRole.AI_TECHNICIAN]: 'ai_technician',
  [UserRole.ADMIN]: 'admin',
  [UserRole.SUPER_ADMIN]: 'super_admin',
  [UserRole.SUPPORT]: 'support',
};

export function toRoleSlug(role: UserRole): IdentityRoleSlug {
  return ROLE_SLUG_MAP[role];
}

export function roleAllowsPanelAccess(role: UserRole): boolean {
  return isPanelAdminRole(role) || isDoctorRole(role) || isTechnicianRole(role);
}

export function roleAllowsMobileAccess(role: UserRole): boolean {
  return isCustomerRole(role);
}

export function assertUserCanAuthenticate(status: import('../../../generated/prisma/index.js').UserStatus): boolean {
  return isUserActive(status);
}
