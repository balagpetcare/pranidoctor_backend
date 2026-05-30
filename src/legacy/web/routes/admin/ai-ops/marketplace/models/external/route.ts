import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../../../modules/ai/admin/ai-admin.guard.js';
import { getExternalModelRegistrationService } from '../../../../../../../../modules/ai/marketplace/external-model.service.js';
import { registerExternalModelSchema } from '../../../../../../../../modules/ai/marketplace/marketplace.types.js';

export async function GET() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  try {
    const data = await getExternalModelRegistrationService().listExternal();
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list external models';
    return jsonError('AI_MARKETPLACE_ERROR', message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  try {
    const body = registerExternalModelSchema.parse(json);
    const data = await getExternalModelRegistrationService().register(body);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register model';
    return jsonError('AI_MARKETPLACE_ERROR', message, 400);
  }
}
