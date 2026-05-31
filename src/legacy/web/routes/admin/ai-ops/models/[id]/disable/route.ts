import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  getAiModelRegistryService,
  requireAiAdminCapability,
} from '../../../../../../../../modules/ai/admin/index.js';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const data = await getAiModelRegistryService().disableModel(id, auth.actor);
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to disable model'),
      400,
    );
  }
}
