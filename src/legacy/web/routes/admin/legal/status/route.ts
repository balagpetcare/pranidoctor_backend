import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { getAdminSession } from '@/lib/admin-auth/session';
import { getIdentityAuthService } from '@auth/identity-auth.service.js';
import { getPanelLegalStatus } from '@/lib/panel-legal/panel-legal.service';

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const session = await getAdminSession();
  if (!session) {
    return jsonError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const actor = await getIdentityAuthService().admin.resolveActor(session);
  if (!actor) {
    return jsonError('FORBIDDEN', 'Forbidden', 403);
  }

  try {
    const status = await getPanelLegalStatus(actor.id, actor.role);
    return jsonOk(status);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load legal status', 500);
  }
}
