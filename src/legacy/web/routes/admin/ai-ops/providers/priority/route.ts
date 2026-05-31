import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  batchProviderPrioritySchema,
  getAiProviderManagementService,
  parseJsonBody,
  requireAiAdminCapability,
} from '../../../../../../modules/ai/admin/index.js';

export async function PUT(request: Request) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  try {
    const json = await parseJsonBody(request);
    const body = batchProviderPrioritySchema.parse(json);
    const data = await getAiProviderManagementService().updatePriorities(body.items, auth.actor);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to update provider priorities'), 400);
  }
}
