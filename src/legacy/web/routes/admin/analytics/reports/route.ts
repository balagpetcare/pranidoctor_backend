import { jsonError } from '@/lib/api-response';
import { requireAdminApiActor } from '@/lib/admin-auth/api-guard';
import { assertAdminCan } from '@/lib/admin-auth/permissions';
import {
  parseAdminAnalyticsQuery,
  getAdminAnalyticsController,
} from '../../../../../../modules/admin-analytics/index.js';

export const GET = async (request: Request): Promise<Response> => {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;

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

  const needsExport = parsed.data.format === 'csv';
  const denied = assertAdminCan(
    auth.actor,
    needsExport ? 'analytics.export' : 'analytics.view',
    request,
  );
  if (denied) return denied;

  try {
    const controller = getAdminAnalyticsController();
    const data = await controller.reports(parsed.data);

    if (
      data &&
      typeof data === 'object' &&
      'format' in data &&
      (data as { format: string }).format === 'csv' &&
      'content' in data
    ) {
      const csv = data as { content: string; filename: string };
      return new Response(csv.content, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${csv.filename}"`,
        },
      });
    }

    const { jsonOk } = await import('@/lib/api-response');
    return jsonOk(data);
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to load reports', 500);
  }
};
