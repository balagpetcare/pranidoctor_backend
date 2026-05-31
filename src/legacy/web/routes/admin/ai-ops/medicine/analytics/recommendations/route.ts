import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getRecommendationAnalyticsService } from '../../../../../../../../modules/ai/medicine/analytics/recommendation-analytics.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../modules/ai/admin/index.js';

const QuerySchema = z.object({
  genericId: z.string().optional(),
  customerId: z.string().optional(),
  organizationId: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.analytics.view');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse({
      genericId: searchParams.get('genericId') ?? undefined,
      customerId: searchParams.get('customerId') ?? undefined,
      organizationId: searchParams.get('organizationId') ?? undefined,
      limit: searchParams.get('limit') ?? 50,
      offset: searchParams.get('offset') ?? 0,
    });

    const service = getRecommendationAnalyticsService();
    const result = await service.getRecentLogs({
      genericId: query.genericId,
      customerId: query.customerId,
      organizationId: query.organizationId,
      limit: query.limit,
      offset: query.offset,
    });

    return jsonOk(result);
  } catch (error) {
    console.error('[medicine/analytics/recommendations GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
