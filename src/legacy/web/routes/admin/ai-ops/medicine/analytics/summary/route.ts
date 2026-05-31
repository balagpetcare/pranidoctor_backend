import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getRecommendationAnalyticsService } from '../../../../../../../../modules/ai/medicine/analytics/recommendation-analytics.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../modules/ai/admin/index.js';

const QuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  organizationId: z.string().optional(),
});

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.analytics.view');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      organizationId: searchParams.get('organizationId') ?? undefined,
    });

    const service = getRecommendationAnalyticsService();
    const summary = await service.getSummary({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      organizationId: query.organizationId,
    });

    return jsonOk(summary);
  } catch (error) {
    console.error('[medicine/analytics/summary GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
