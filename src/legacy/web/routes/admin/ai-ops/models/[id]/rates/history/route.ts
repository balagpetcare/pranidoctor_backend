import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  getAiModelRegistryService,
  requireAiAdminCapability,
} from '../../../../../../../../modules/ai/admin/index.js';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const data = await getAiModelRegistryService().listRateHistory(id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to load rate history'),
      404,
    );
  }
}
