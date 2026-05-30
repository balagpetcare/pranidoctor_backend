import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../../modules/ai/admin/ai-admin.guard.js';
import {
  getAiRegistryAdminService,
  updateFailoverRuleSchema,
} from '../../../../../../../modules/ai/admin/index.js';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  try {
    const body = updateFailoverRuleSchema.parse(json);
    const data = await getAiRegistryAdminService().updateFailoverRule(id, body, auth.actor.id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update failover rule';
    return jsonError('AI_ADMIN_ERROR', message, 400);
  }
}
