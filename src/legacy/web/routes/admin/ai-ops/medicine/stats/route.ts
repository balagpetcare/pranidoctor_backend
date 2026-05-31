import { jsonError, jsonOk } from '@/lib/api-response';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../modules/ai/admin/index.js';
import { getMedicineAdminService } from '../../../../../../../modules/ai/medicine/index.js';

export async function GET() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.ops.view');
  if (denied) return denied;

  try {
    const data = await getMedicineAdminService().getStats();
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get medicine stats';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 500);
  }
}
