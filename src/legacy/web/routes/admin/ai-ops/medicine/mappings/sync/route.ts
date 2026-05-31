import { jsonError, jsonOk } from '@/lib/api-response';
import { getGenericBrandMappingService } from '../../../../../../../../modules/ai/medicine/mapping/generic-brand-mapping.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../modules/ai/admin/index.js';

export async function POST() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.knowledge.write');
  if (denied) return denied;

  try {
    const service = getGenericBrandMappingService();
    const result = await service.syncAllGraphEdges();

    return jsonOk(result);
  } catch (error) {
    console.error('[medicine/mappings/sync POST]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
