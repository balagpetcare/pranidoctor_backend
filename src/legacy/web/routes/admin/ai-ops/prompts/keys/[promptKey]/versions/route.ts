import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, requireAiAdminCapability } from '../../../../../../../../modules/ai/admin/index.js';
import { listPromptVersionsAdmin } from '../../../../../../../../modules/ai/admin/ai-prompt-admin.service.js';

export async function GET(
  _request: Request,
  context: { params: Promise<{ promptKey: string }> },
) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  const { promptKey } = await context.params;
  try {
    const data = await listPromptVersionsAdmin(promptKey);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load prompt versions'), 500);
  }
}
