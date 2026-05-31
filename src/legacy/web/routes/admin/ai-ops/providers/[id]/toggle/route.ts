import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  getAiProviderManagementService,
  requireAiAdminCapability,
  toggleEnabledSchema,
} from '../../../../../../../../modules/ai/admin/index.js';

export async function POST(
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
    const { enabled } = toggleEnabledSchema.parse(json);
    const svc = getAiProviderManagementService();
    const data = enabled
      ? await svc.enableProvider(id, auth.actor)
      : await svc.disableProvider(id, auth.actor);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle provider';
    return jsonError('AI_ADMIN_ERROR', message, 400);
  }
}
