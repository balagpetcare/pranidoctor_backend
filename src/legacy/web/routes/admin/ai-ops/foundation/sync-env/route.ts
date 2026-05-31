import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  assertAiAdminCan,
  getAiFoundationAdminService,
  requireAiSuperAdmin,
} from '../../../../../../modules/ai/admin/index.js';

export async function POST() {
  const auth = await requireAiSuperAdmin();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.foundation.manage');
  if (denied) return denied;

  try {
    const data = await getAiFoundationAdminService().syncEnvKeysToVault(auth.actor);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to sync env keys'), 400);
  }
}
