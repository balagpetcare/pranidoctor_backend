import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, requireAiAdminCapability } from '../../../../../../../../modules/ai/admin/index.js';
import { getAiUsageReportService } from '../../../../../../../../modules/ai/analytics/usage/ai-usage-report.service.js';
import {
  auditAnalyticsExport,
  requireScopedAnalyticsAccess,
} from '../../../../../../../../modules/ai/analytics/security/ai-analytics-access.util.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminCapability('ai.analytics.export');
  if (!auth.ok) return auth.response;
  try {
    const filters = await requireScopedAnalyticsAccess(request, auth.actor);
    if (filters instanceof Response) return filters;
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') ?? 'json').toLowerCase();
    const limit = Math.min(10_000, Math.max(1, Number(url.searchParams.get('limit') ?? 5000)));

    if (format === 'csv') {
      const csv = await getAiUsageReportService().generateCsv(filters, { limit });
      const rowCount = Math.max(0, csv.split('\n').length - 1);
      await auditAnalyticsExport(auth.actor, filters, 'csv', rowCount);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ai-usage-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const data = await getAiUsageReportService().generateReport(filters, { limit });
    await auditAnalyticsExport(auth.actor, filters, 'json', data.summary.rowCount);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to generate usage report'), 500);
  }
}
