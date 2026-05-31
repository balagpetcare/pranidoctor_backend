import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, getAiOperationsService, requireAiAdminCapability } from '../../../../../../../modules/ai/admin/index.js';

export async function GET() {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  try {
    const data = await getAiOperationsService().getOperationsDashboard();
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load operations dashboard'), 500);
  }
}
