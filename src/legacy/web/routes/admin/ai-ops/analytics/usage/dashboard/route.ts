import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../modules/ai/admin/ai-admin.guard.js';
import { parseAnalyticsDateRange } from '../../../../../../modules/ai/analytics/usage/ai-usage-analytics.util.js';
import { getAiUsageAnalyticsService } from '../../../../../../modules/ai/analytics/usage/ai-usage-analytics.service.js';

function parseFilters(request: Request) {
  const url = new URL(request.url);
  const rangeInput: { from?: string; to?: string; sinceDays?: number } = {};
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const sinceDays = url.searchParams.get('sinceDays');
  if (from) rangeInput.from = from;
  if (to) rangeInput.to = to;
  if (sinceDays) rangeInput.sinceDays = Number(sinceDays);
  const { from: fromDate, to: toDate } = parseAnalyticsDateRange(rangeInput);
  return {
    from: fromDate,
    to: toDate,
    branchId: url.searchParams.get('branchId') ?? undefined,
    organizationId: url.searchParams.get('organizationId') ?? undefined,
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    feature: url.searchParams.get('feature') ?? undefined,
    provider: url.searchParams.get('provider') ?? undefined,
    taskType: url.searchParams.get('taskType') ?? undefined,
  };
}

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  try {
    const filters = parseFilters(request);
    const data = await getAiUsageAnalyticsService().getDashboard(filters);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load usage dashboard';
    return jsonError('AI_ADMIN_ERROR', message, 500);
  }
}
