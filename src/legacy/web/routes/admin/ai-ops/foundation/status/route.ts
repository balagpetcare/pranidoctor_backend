import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  assertAiAdminCan,
  getAiFoundationAdminService,
  requireAiAdminActor,
  settingsScopeQuerySchema,
} from '../../../../../../modules/ai/admin/index.js';
import { PLATFORM_SCOPE_KEY } from '../../../../../../modules/ai/prompts/management/prompt-management.types.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.ops.view');
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const parsed = settingsScopeQuerySchema.safeParse({
      scopeKey: url.searchParams.get('scopeKey') ?? undefined,
    });
    const scopeKey = parsed.success ? parsed.data.scopeKey ?? PLATFORM_SCOPE_KEY : PLATFORM_SCOPE_KEY;
    const data = await getAiFoundationAdminService().getStatus(scopeKey);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load foundation status'), 500);
  }
}
