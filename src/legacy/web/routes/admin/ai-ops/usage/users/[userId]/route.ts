import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, requireAiAdminCapability } from '../../../../../../../modules/ai/admin/index.js';
import { getAiUsageService } from '../../../../../../../modules/ai/usage/ai-usage.service.js';

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAiAdminCapability('ai.analytics.view');
  if (!auth.ok) return auth.response;
  const { userId } = await context.params;
  try {
    const url = new URL(request.url);
    const sinceDays = Math.min(90, Math.max(1, Number(url.searchParams.get('sinceDays') ?? 30)));
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const data = await getAiUsageService().getUserConsumption(userId, since);
    return jsonOk({ userId, sinceDays, ...data });
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load user usage'), 500);
  }
}
