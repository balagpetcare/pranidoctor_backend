import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, requireAiAdminCapability } from '../../../../../../modules/ai/admin/index.js';
import { getAiReadinessService } from '../../../../../../modules/ai/platform/ai-readiness.service.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const live = url.searchParams.get('live') === 'true';
    const data = await getAiReadinessService().checkAll({ liveProviderProbe: live });
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to check AI readiness'), 500);
  }
}
