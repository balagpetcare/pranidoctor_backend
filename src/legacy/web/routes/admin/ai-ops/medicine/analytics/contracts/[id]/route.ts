import { jsonError, jsonOk } from '@/lib/api-response';
import { getContractAnalyticsService } from '../../../../../../../../../modules/ai/medicine/analytics/contract-analytics.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../../modules/ai/admin/index.js';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.analytics.view');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const service = getContractAnalyticsService();
    const metrics = await service.getContractPerformance(id);

    if (!metrics) {
      return jsonError('NOT_FOUND', 'Contract not found', 404);
    }

    return jsonOk(metrics);
  } catch (error) {
    console.error('[medicine/analytics/contracts/[id] GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
