import { jsonError, jsonOk } from '../../legacy/web/lib/api-response.js';
import { requireAdminApiActor } from '../../legacy/web/lib/admin-auth/api-guard.js';
import { assertAdminCan } from '../../legacy/web/lib/admin-auth/permissions.js';
import type { AdminAnalyticsDateRangeQuery } from './admin-analytics.schemas.js';
import { parseAdminAnalyticsQuery } from './admin-analytics.schemas.js';
import { getAdminAnalyticsController } from './admin-analytics.controller.js';

type Handler = (
  controller: ReturnType<typeof getAdminAnalyticsController>,
  query: AdminAnalyticsDateRangeQuery,
) => Promise<unknown>;

export function createAdminAnalyticsRouteHandler(handler: Handler) {
  return async function GET(request: Request): Promise<Response> {
    const auth = await requireAdminApiActor();
    if (!auth.ok) return auth.response;

    const denied = assertAdminCan(auth.actor, 'analytics.view', request);
    if (denied) return denied;

    const url = new URL(request.url);
    const parsed = parseAdminAnalyticsQuery(url.searchParams);
    if (!parsed.success) {
      return jsonError(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        422,
        parsed.error.flatten(),
      );
    }

    try {
      const controller = getAdminAnalyticsController();
      const data = await handler(controller, parsed.data);

      if (
        data &&
        typeof data === 'object' &&
        'format' in data &&
        (data as { format: string }).format === 'csv' &&
        'content' in data
      ) {
        const csv = data as unknown as { content: string; filename: string };
        return new Response(csv.content, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${csv.filename}"`,
          },
        });
      }

      return jsonOk(data);
    } catch {
      return jsonError('DATABASE_ERROR', 'Failed to load analytics', 500);
    }
  };
}
