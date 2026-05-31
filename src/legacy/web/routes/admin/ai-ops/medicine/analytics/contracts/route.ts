import { jsonError, jsonOk } from '@/lib/api-response';
import { getContractAnalyticsService } from '../../../../../../../../modules/ai/medicine/analytics/contract-analytics.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../modules/ai/admin/index.js';

export async function GET() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.analytics.view');
  if (denied) return denied;

  try {
    const service = getContractAnalyticsService();
    const summary = await service.getSummary();

    return jsonOk(summary);
  } catch (error) {
    console.error('[medicine/analytics/contracts GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
