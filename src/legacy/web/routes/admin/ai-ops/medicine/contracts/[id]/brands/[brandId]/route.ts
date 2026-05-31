import { jsonError, jsonOk } from '@/lib/api-response';
import { getContractService } from '../../../../../../../../../../modules/ai/medicine/contracts/contract.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../../../modules/ai/admin/index.js';

type RouteContext = { params: Promise<{ id: string; brandId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.write');
  if (denied) return denied;

  try {
    const { id, brandId } = await context.params;
    const service = getContractService();
    await service.removeBrand(id, brandId, auth.actor.id);

    return jsonOk({ success: true });
  } catch (error) {
    console.error('[medicine/contracts/[id]/brands/[brandId] DELETE]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
