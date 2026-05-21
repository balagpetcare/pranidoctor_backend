/**
 * Phase 1 identity-core — shared role/status checks and phone normalization.
 * Canonical for new module code; legacy paths re-export as needed.
 */
import { UserRole, UserStatus } from '../../generated/prisma/index.js';

export { maskBdMobilePhone, normalizeBdMobilePhone } from './phone.js';

/** Panel channels for audit and session context. */
export const AUTH_CHANNELS = {
  adminPanel: 'admin_panel',
  doctorPanel: 'doctor_panel',
  technicianPanel: 'technician_panel',
  mobile: 'mobile',
} as const;

export type AuthChannel = (typeof AUTH_CHANNELS)[keyof typeof AUTH_CHANNELS];

export function isUserActive(status: UserStatus): boolean {
  return status === UserStatus.ACTIVE;
}

export function isPanelAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export function isDoctorRole(role: UserRole): boolean {
  return role === UserRole.DOCTOR;
}

export function isTechnicianRole(role: UserRole): boolean {
  return role === UserRole.AI_TECHNICIAN;
}

export function isCustomerRole(role: UserRole): boolean {
  return role === UserRole.CUSTOMER;
}
