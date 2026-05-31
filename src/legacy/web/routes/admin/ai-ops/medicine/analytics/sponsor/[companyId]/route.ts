import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getRecommendationAnalyticsService } from '../../../../../../../../../modules/ai/medicine/analytics/recommendation-analytics.service.js';
import { getContractAnalyticsService } from '../../../../../../../../../modules/ai/medicine/analytics/contract-analytics.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../../modules/ai/admin/index.js';

type RouteContext = { params: Promise<{ companyId: string }> };

const QuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.analytics.view');
  if (denied) return denied;

  try {
    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
    });

    const recService = getRecommendationAnalyticsService();
    const contractService = getContractAnalyticsService();

    const [sponsorImpact, sponsorContracts] = await Promise.all([
      recService.getSponsorImpactReport(companyId, {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      }),
      contractService.getContractsBySponsor(companyId),
    ]);

    return jsonOk({
      sponsorImpact,
      contracts: sponsorContracts,
    });
  } catch (error) {
    console.error('[medicine/analytics/sponsor/[companyId] GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
