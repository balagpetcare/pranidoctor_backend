import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { resolveAdminPanelActor } from '@/lib/admin-auth/panel-access';
import { getAdminSession } from '@/lib/admin-auth/session';
import { getPanelLegalStatus } from '@/lib/panel-legal/panel-legal.service';

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;

  const session = await getAdminSession(request);
  if (!session) {
    return jsonError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const actor = await resolveAdminPanelActor(session);
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
