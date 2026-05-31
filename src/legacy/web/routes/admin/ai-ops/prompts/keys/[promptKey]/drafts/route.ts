import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, requireAiAdminCapability } from '../../../../../../../../modules/ai/admin/index.js';
import { createPromptDraftFromPublishedAdmin } from '../../../../../../../../modules/ai/admin/ai-prompt-admin.service.js';

export async function POST(
  request: Request,
  context: { params: Promise<{ promptKey: string }> },
) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  const { promptKey } = await context.params;
  try {
    const data = await createPromptDraftFromPublishedAdmin(request, auth.actor, promptKey);
    return jsonOk(data, { status: 201 });
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to create prompt draft'), 400);
  }
}
