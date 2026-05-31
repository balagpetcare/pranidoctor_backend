import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, parseJsonBody, requireAiAdminCapability } from '../../../../../../../modules/ai/admin/index.js';
import {
  deletePromptDraftAdmin,
  getPromptAdmin,
  updatePromptAdmin,
} from '../../../../../../../modules/ai/admin/ai-prompt-admin.service.js';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const data = await getPromptAdmin(id);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load prompt'), 500);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const body = await parseJsonBody(request);
    const data = await updatePromptAdmin(request, auth.actor, id, body);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to update prompt'), 400);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const data = await deletePromptDraftAdmin(request, auth.actor, id);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to delete prompt'), 400);
  }
}
