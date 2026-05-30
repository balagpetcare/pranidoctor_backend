import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../../modules/ai/admin/ai-admin.guard.js';
import {
  getAiRegistryAdminService,
  updateProviderSchema,
} from '../../../../../../../modules/ai/admin/index.js';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const data = await getAiRegistryAdminService().getProvider(id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider not found';
    return jsonError('NOT_FOUND', message, 404);
  }
}

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
    const body = updateProviderSchema.parse(json);
    const data = await getAiRegistryAdminService().updateProvider(id, body, auth.actor.id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update provider';
    return jsonError('AI_ADMIN_ERROR', message, 400);
  }
}
