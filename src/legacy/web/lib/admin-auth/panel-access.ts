import type { AdminJwtPayload } from './jwt';
import type { AdminPanelActor } from './panel-classify';

export type { AdminPanelActor } from './panel-classify';

import { getIdentityAuthService } from '../../../../modules/auth/identity-auth.service.js';

/**
 * Authoritative check: JWT subject must be an ACTIVE user with ADMIN or SUPER_ADMIN role
 * and an AdminProfile row. Use on API routes, `/api/admin/auth/me`, and dashboard layout.
 */
export async function resolveAdminPanelActor(
  session: AdminJwtPayload,
): Promise<AdminPanelActor | null> {
  return getIdentityAuthService().admin.resolveActor(session);
}
