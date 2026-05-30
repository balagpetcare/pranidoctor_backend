import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../modules/ai/admin/ai-admin.guard.js';
import {
  createModelSchema,
  getAiRegistryAdminService,
} from '../../../../../../modules/ai/admin/index.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const providerId = url.searchParams.get('providerId') ?? undefined;
  try {
    const data = await getAiRegistryAdminService().listModels(undefined, providerId);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load models';
    return jsonError('AI_ADMIN_ERROR', message, 500);
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
    const body = createModelSchema.parse(json);
    const data = await getAiRegistryAdminService().createModel(body, auth.actor.id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create model';
    return jsonError('AI_ADMIN_ERROR', message, 400);
  }
}
