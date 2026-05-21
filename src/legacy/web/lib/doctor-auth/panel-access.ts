import type { DoctorJwtPayload } from './jwt';
import type { DoctorPanelActor } from './panel-classify';

export type { DoctorPanelActor } from './panel-classify';

import { getIdentityAuthService } from '../../../../modules/auth/identity-auth.service.js';

/**
 * JWT subject must be an ACTIVE doctor user with an ACTIVE provider profile.
 */
export async function resolveDoctorPanelActor(
  session: DoctorJwtPayload,
): Promise<DoctorPanelActor | null> {
  return getIdentityAuthService().doctor.resolveActor(session);
}
