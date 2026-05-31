import { jsonError, jsonOk } from '@/lib/api-response';
import {
  assertAiAdminCan,
  createProviderSchema,
  getAiProviderManagementService,
  requireAiAdminActor,
} from '../../../../../../modules/ai/admin/index.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.ops.view');
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const scopeKey = url.searchParams.get('scopeKey') ?? undefined;
    const data = await getAiProviderManagementService().listProviders(scopeKey ?? undefined);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load providers';
    return jsonError('AI_ADMIN_ERROR', message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.registry.manage');
  if (denied) return denied;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  try {
    const body = createProviderSchema.parse(json);
    const data = await getAiProviderManagementService().createProvider(body, auth.actor);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create provider';
    return jsonError('AI_ADMIN_ERROR', message, 400);
  }
}
