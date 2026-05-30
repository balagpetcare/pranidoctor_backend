import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../modules/ai/admin/ai-admin.guard.js';
import {
  createRouteSchema,
  getAiRegistryAdminService,
} from '../../../../../../modules/ai/admin/index.js';

export async function GET() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  try {
    const data = await getAiRegistryAdminService().listRoutes();
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load routes';
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
    const body = createRouteSchema.parse(json);
    const data = await getAiRegistryAdminService().createRoute(body, auth.actor.id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create route';
    return jsonError('AI_ADMIN_ERROR', message, 400);
  }
}
