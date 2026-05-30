import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../modules/ai/admin/ai-admin.guard.js';
import {
  createFailoverRuleSchema,
  getAiRegistryAdminService,
} from '../../../../../../modules/ai/admin/index.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const routeId = url.searchParams.get('routeId') ?? undefined;
  try {
    const data = await getAiRegistryAdminService().listFailoverRules(undefined, routeId);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load failover rules';
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
    const body = createFailoverRuleSchema.parse(json);
    const data = await getAiRegistryAdminService().createFailoverRule(body, auth.actor.id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create failover rule';
    return jsonError('AI_ADMIN_ERROR', message, 400);
  }
}
