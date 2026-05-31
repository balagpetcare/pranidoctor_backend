import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, getAiOperationsService, requireAiAdminCapability } from '../../../../../../../modules/ai/admin/index.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const taskType = url.searchParams.get('taskType');
    if (!taskType) {
      return jsonError('VALIDATION_ERROR', 'taskType query parameter is required', 400);
    }
    const scopeKey = url.searchParams.get('scopeKey') ?? undefined;
    const data = await getAiOperationsService().getRoutePreview(taskType, scopeKey);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to preview route'), 500);
  }
}
