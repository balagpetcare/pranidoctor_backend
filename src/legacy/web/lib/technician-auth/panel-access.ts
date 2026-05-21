import type { TechnicianJwtPayload } from './jwt';
import type { TechnicianPanelActor } from './panel-classify';

export type { TechnicianPanelActor } from './panel-classify';

import { getIdentityAuthService } from '../../../../modules/auth/identity-auth.service.js';

export async function resolveTechnicianPanelActor(
  session: TechnicianJwtPayload,
): Promise<TechnicianPanelActor | null> {
  return getIdentityAuthService().technician.resolveActor(session);
}
