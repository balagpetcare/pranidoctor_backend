import { jsonError, jsonOk } from '../../legacy/web/lib/api-response.js';
import { requireAdminApiActor } from '../../legacy/web/lib/admin-auth/api-guard.js';

import type { AiAdminController } from './ai.controller.js';
import { getAiAdminController } from './ai-admin.controller.js';

type Handler = (controller: AiAdminController, request: Request) => Promise<unknown>;

export function createAiAdminRouteHandler(handler: Handler) {
  return async function route(request: Request): Promise<Response> {
    const auth = await requireAdminApiActor();
    if (!auth.ok) return auth.response;

    if (auth.actor.role !== 'SUPER_ADMIN' && auth.actor.role !== 'ADMIN') {
      return jsonError('FORBIDDEN', 'Admin role required', 403);
    }

    try {
      const controller = getAiAdminController();
      const data = await handler(controller, request);
      return jsonOk(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI admin request failed';
      return jsonError('AI_ADMIN_ERROR', message, 500);
    }
  };
}
