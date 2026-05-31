import { jsonError, jsonOk } from '@/lib/api-response';
import { getContractService } from '../../../../../../../../../modules/ai/medicine/contracts/contract.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../../modules/ai/admin/index.js';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.write');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const service = getContractService();
    const contract = await service.pause(id, auth.actor.id);

    return jsonOk(contract);
  } catch (error) {
    console.error('[medicine/contracts/[id]/pause POST]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
