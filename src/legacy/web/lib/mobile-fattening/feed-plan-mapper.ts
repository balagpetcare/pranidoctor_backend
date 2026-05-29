import type { BatchFeedPlan, BatchFeedPlanMode } from "@/generated/prisma/client";

export type BatchFeedPlanJsonDto = {
  id: string;
  batchId: string;
  mode: BatchFeedPlanMode;
  dailyAmountKg: string | null;
  dailyCostBdt: string | null;
  feedType: string | null;
  unit: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toBatchFeedPlanJsonDto(row: BatchFeedPlan): BatchFeedPlanJsonDto {
  return {
    id: row.id,
    batchId: row.batchId,
    mode: row.mode,
    dailyAmountKg: row.dailyAmountKg?.toString() ?? null,
    dailyCostBdt: row.dailyCostBdt?.toString() ?? null,
    feedType: row.feedType,
    unit: row.unit,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
