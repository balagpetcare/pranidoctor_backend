import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  getAiModelRegistryService,
  requireAiAdminCapability,
  updateModelSchema,
} from '../../../../../../../modules/ai/admin/index.js';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const data = await getAiModelRegistryService().getModel(id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to load model'),
      404,
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  try {
    const body = updateModelSchema.parse(json);
    const data = await getAiModelRegistryService().updateModel(id, body, auth.actor.id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to update model'),
      400,
    );
  }
}
