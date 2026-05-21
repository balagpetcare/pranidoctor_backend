/**
 * Phase 1 permissions-registry — admin capability matrix (single source of truth).
 *
 * Doctor panel: route guards use `requireDoctor` + `UserStatus.ACTIVE` + `ProviderStatus.ACTIVE`
 * on `DoctorProfile` (see legacy `doctor-auth/guard.ts`).
 *
 * Technician panel: `requireTechnician` + active `AiTechnicianProfile` with `ProviderStatus.ACTIVE`
 * (see legacy `technician-auth/guard.ts` and login route).
 */
import { AuthAuditAction, UserRole } from '../../generated/prisma/index.js';
import { compatAuthJsonError } from './i18n/compat-error.js';
import type { NextResponse } from '../../compat/next-server.js';

import { recordAuthAuditFireAndForget } from './auth-audit.service.js';
import { AUTH_CHANNELS } from './identity-core.js';

/** Matches legacy `AdminPanelActor` in panel-classify.ts. */
export type AdminPanelActor = {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
};

export type ServiceInstanceAdminCapability =
  | 'serviceInstance.view'
  | 'serviceInstance.review'
  | 'serviceInstance.publish';

const ROLE_MATRIX: Record<
  UserRole,
  Partial<Record<ServiceInstanceAdminCapability, true>> | undefined
> = {
  [UserRole.SUPER_ADMIN]: {
    'serviceInstance.view': true,
    'serviceInstance.review': true,
    'serviceInstance.publish': true,
  },
  [UserRole.ADMIN]: {
    'serviceInstance.view': true,
    'serviceInstance.review': true,
  },
  [UserRole.SUPPORT]: {
    'serviceInstance.view': true,
  },
  [UserRole.CUSTOMER]: undefined,
  [UserRole.DOCTOR]: undefined,
  [UserRole.AI_TECHNICIAN]: undefined,
};

export function adminCan(
  actor: AdminPanelActor,
  capability: ServiceInstanceAdminCapability,
): boolean {
  return !!ROLE_MATRIX[actor.role]?.[capability];
}

export function assertAdminCan(
  actor: AdminPanelActor,
  capability: ServiceInstanceAdminCapability,
  request?: Request,
): NextResponse | null {
  if (!adminCan(actor, capability)) {
    recordAuthAuditFireAndForget({
      action: AuthAuditAction.PERMISSION_DENIED,
      channel: AUTH_CHANNELS.adminPanel,
      userId: actor.id,
      role: actor.role,
      metadata: { capability },
    });
    const req = request ?? new Request('http://localhost/api/admin');
    return compatAuthJsonError(req, 'FORBIDDEN', 403, {
      messageKey: 'PERMISSION_DENIED',
      details: { capability },
    });
  }
  return null;
}

/** Exported for tests and documentation. */
export function getAdminCapabilityMatrix(): Readonly<
  Record<UserRole, Partial<Record<ServiceInstanceAdminCapability, true>> | undefined>
> {
  return ROLE_MATRIX;
}
