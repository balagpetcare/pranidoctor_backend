import { getPrisma } from '../../../../shared/database/prisma.js';
import { getLogger } from '../../../../shared/logger/logger.js';

export type ReconciliationRunType = 'daily' | 'monthly' | 'validate';
export type ReconciliationRunStatus = 'success' | 'failed' | 'drift';

export interface RecordReconciliationRunInput {
  runType: ReconciliationRunType;
  bucketKey: string;
  status: ReconciliationRunStatus;
  logCount?: number;
  rollupsUpserted?: number;
  driftUsd?: number | null;
  driftRequests?: number | null;
  durationMs: number;
  errorMessage?: string | null;
  metadataJson?: Record<string, unknown>;
  startedAt?: Date;
}

export interface ReconciliationRunSummary {
  id: string;
  runType: ReconciliationRunType;
  bucketKey: string;
  status: ReconciliationRunStatus;
  logCount: number;
  rollupsUpserted: number;
  driftUsd: number | null;
  driftRequests: number | null;
  durationMs: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export class AiAnalyticsReconciliationRunService {
  readonly name = 'AiAnalyticsReconciliationRunService';

  async recordRun(input: RecordReconciliationRunInput): Promise<string> {
    const startedAt = input.startedAt ?? new Date();
    const row = await getPrisma().aiAnalyticsReconciliationRun.create({
      data: {
        runType: input.runType,
        bucketKey: input.bucketKey,
        status: input.status,
        logCount: input.logCount ?? 0,
        rollupsUpserted: input.rollupsUpserted ?? 0,
        driftUsd: input.driftUsd ?? null,
        driftRequests: input.driftRequests ?? null,
        durationMs: input.durationMs,
        errorMessage: input.errorMessage ?? null,
        metadataJson: input.metadataJson as never,
        startedAt,
        completedAt: new Date(),
      },
    });
    return row.id;
  }

  async getLastRun(runType: ReconciliationRunType): Promise<ReconciliationRunSummary | null> {
    const row = await getPrisma().aiAnalyticsReconciliationRun.findFirst({
      where: { runType },
      orderBy: { startedAt: 'desc' },
    });
    if (!row) return null;
    return this.toSummary(row);
  }

  async listRecentRuns(limit = 20): Promise<ReconciliationRunSummary[]> {
    const rows = await getPrisma().aiAnalyticsReconciliationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((row) => this.toSummary(row));
  }

  private toSummary(row: {
    id: string;
    runType: string;
    bucketKey: string;
    status: string;
    logCount: number;
    rollupsUpserted: number;
    driftUsd: { toString(): string } | null;
    driftRequests: number | null;
    durationMs: number;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
  }): ReconciliationRunSummary {
    return {
      id: row.id,
      runType: row.runType as ReconciliationRunType,
      bucketKey: row.bucketKey,
      status: row.status as ReconciliationRunStatus,
      logCount: row.logCount,
      rollupsUpserted: row.rollupsUpserted,
      driftUsd: row.driftUsd != null ? Number(row.driftUsd.toString()) : null,
      driftRequests: row.driftRequests,
      durationMs: row.durationMs,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}

let service: AiAnalyticsReconciliationRunService | null = null;

export function getAiAnalyticsReconciliationRunService(): AiAnalyticsReconciliationRunService {
  if (!service) service = new AiAnalyticsReconciliationRunService();
  return service;
}

export function resetAiAnalyticsReconciliationRunServiceForTests(): void {
  service = null;
}

export async function persistReconciliationFailure(
  runType: ReconciliationRunType,
  bucketKey: string,
  error: unknown,
  startedAt: Date,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  getLogger().error({ runType, bucketKey, error: message }, 'AI analytics reconciliation failed');
  await getAiAnalyticsReconciliationRunService().recordRun({
    runType,
    bucketKey,
    status: 'failed',
    durationMs: Date.now() - startedAt.getTime(),
    errorMessage: message,
    startedAt,
  });
}
