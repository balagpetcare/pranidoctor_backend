import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  parseJsonBody,
  requireAiAdminCapability,
} from '../../../../../../modules/ai/admin/index.js';
import {
  createPromptAdmin,
  listPromptsAdmin,
} from '../../../../../../modules/ai/admin/ai-prompt-admin.service.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  try {
    const data = await listPromptsAdmin(request);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load prompts'), 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  try {
    const body = await parseJsonBody(request);
    const data = await createPromptAdmin(request, auth.actor, body);
    return jsonOk(data, { status: 201 });
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to create prompt'), 400);
  }
}
