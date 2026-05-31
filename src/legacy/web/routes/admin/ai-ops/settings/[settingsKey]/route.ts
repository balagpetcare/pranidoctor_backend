import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  assertAiAdminCan,
  getAiSettingsAdminService,
  isKnownSettingsKey,
  requireAiAdminActor,
  upsertSettingsSchema,
} from '../../../../../../../modules/ai/admin/index.js';
import { PLATFORM_SCOPE_KEY } from '../../../../../../../modules/ai/prompts/management/prompt-management.types.js';

type RouteContext = { params: Promise<{ settingsKey: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.ops.view');
  if (denied) return denied;

  try {
    const { settingsKey } = await context.params;
    const data = await getAiSettingsAdminService().get(PLATFORM_SCOPE_KEY, settingsKey);
    if (!data) return jsonError('NOT_FOUND', 'Setting not found', 404);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load setting'), 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.settings.manage');
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }

  try {
    const { settingsKey } = await context.params;
    if (!isKnownSettingsKey(settingsKey)) {
      return jsonError('VALIDATION_ERROR', `Unknown settings key: ${settingsKey}`, 400);
    }
    const body = upsertSettingsSchema.parse(json);
    const scopeKey = body.scopeKey?.trim() || PLATFORM_SCOPE_KEY;
    const data = await getAiSettingsAdminService().upsert(
      scopeKey,
      settingsKey,
      body.settingsJson,
      auth.actor,
    );
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to update setting'), 400);
  }
}
