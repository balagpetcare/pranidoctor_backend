import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  assertAiAdminCan,
  getAiProviderManagementService,
  requireAiSuperAdmin,
} from '../../../../../../../modules/ai/admin/index.js';
import { actorContext } from '../../../../../../../modules/ai/admin/ai-admin.guard.js';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiSuperAdmin();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.secrets.manage');
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const data = await getAiProviderManagementService().testProviderConnection(
      id,
      actorContext(request, auth.actor),
    );
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Connection test failed'), 400);
  }
}
