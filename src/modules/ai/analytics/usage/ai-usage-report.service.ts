import type {
  UsageAnalyticsFilters,
  UsageReportPayload,
  UsageReportRow,
} from './ai-usage-analytics.types.js';
import { getAiUsageAnalyticsService } from './ai-usage-analytics.service.js';
import { buildUsageRecordWhere, decimalToNumber, roundUsd } from './ai-usage-analytics.util.js';
import { getPrisma } from '../../../../shared/database/prisma.js';

export class AiUsageReportService {
  readonly name = 'AiUsageReportService';

  async generateReport(
    filters: UsageAnalyticsFilters,
    options?: { limit?: number },
  ): Promise<UsageReportPayload> {
    const limit = Math.min(options?.limit ?? 5000, 10_000);
    const prisma = getPrisma();

    const [records, logs] = await Promise.all([
      prisma.aiUsageRecord.findMany({
        where: buildUsageRecordWhere(filters),
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      getAiUsageAnalyticsService().listRecentUsageLogs(filters, Math.min(limit, 500)),
    ]);

    const rows: UsageReportRow[] =
      logs.length > 0
        ? logs.map((row) => ({
            timestamp: row.createdAt.toISOString(),
            userId: row.userId,
            branchId: row.branchId,
            organizationId: row.organizationId,
            feature: row.feature ?? 'UNKNOWN',
            taskType: row.taskType,
            provider: row.providerKey,
            model: row.modelKey,
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
            totalTokens: row.totalTokens,
            costUsd: roundUsd(decimalToNumber(row.costUsd)),
            latencyMs: row.latencyMs,
            success: row.success,
            errorCode: row.errorCode,
          }))
        : records.map((row) => ({
            timestamp: row.createdAt.toISOString(),
            userId: row.userId,
            branchId: row.branchId,
            organizationId: row.organizationId,
            feature: row.feature,
            taskType: null,
            provider: row.provider,
            model: row.model,
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
            totalTokens: row.totalTokens,
            costUsd: roundUsd(decimalToNumber(row.costUsd)),
            latencyMs: row.latencyMs,
            success: row.success,
            errorCode: row.errorCode,
          }));

    const totalTokens = rows.reduce((sum, row) => sum + row.totalTokens, 0);
    const costUsd = roundUsd(rows.reduce((sum, row) => sum + row.costUsd, 0));

    return {
      generatedAt: new Date().toISOString(),
      filters,
      rows,
      summary: {
        rowCount: rows.length,
        totalTokens,
        costUsd,
      },
    };
  }

  async generateCsv(filters: UsageAnalyticsFilters, options?: { limit?: number }): Promise<string> {
    const report = await this.generateReport(filters, options);
    const header = [
      'timestamp',
      'userId',
      'branchId',
      'organizationId',
      'feature',
      'taskType',
      'provider',
      'model',
      'inputTokens',
      'outputTokens',
      'totalTokens',
      'costUsd',
      'latencyMs',
      'success',
      'errorCode',
    ];

    const lines = [header.join(',')];
    for (const row of report.rows) {
      lines.push(
        [
          row.timestamp,
          csvCell(row.userId),
          csvCell(row.branchId),
          csvCell(row.organizationId),
          csvCell(row.feature),
          csvCell(row.taskType),
          csvCell(row.provider),
          csvCell(row.model),
          row.inputTokens,
          row.outputTokens,
          row.totalTokens,
          row.costUsd,
          row.latencyMs,
          row.success,
          csvCell(row.errorCode),
        ].join(','),
      );
    }

    return lines.join('\n');
  }
}

function csvCell(value: string | null | undefined): string {
  if (value == null) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

let aiUsageReportService: AiUsageReportService | null = null;

export function getAiUsageReportService(): AiUsageReportService {
  if (!aiUsageReportService) aiUsageReportService = new AiUsageReportService();
  return aiUsageReportService;
}

export function resetAiUsageReportServiceForTests(): void {
  aiUsageReportService = null;
}
