import type { FatteningBatchRoi } from "@/generated/prisma/client";

import { round2 } from "@/lib/mobile-feeds/feed-mapper";

export type FatteningBatchRoiSettingsDto = {
  purchaseCostBdt: number | null;
  projectedSaleBdt: number | null;
  notes: string | null;
};

export type BatchRoiJsonDto = {
  batchId: string;
  purchase: {
    amountBdt: number;
    manualAmountBdt: number | null;
    financeAmountBdt: number;
  };
  feed: { amountBdt: number; recordCount: number };
  treatment: { amountBdt: number; recordCount: number };
  totalCostBdt: number;
  projectedSale: { amountBdt: number };
  profitBdt: number;
  profitMarginPct: number | null;
  settings: FatteningBatchRoiSettingsDto | null;
};

export function toRoiSettingsDto(
  row: FatteningBatchRoi | null,
): FatteningBatchRoiSettingsDto | null {
  if (!row) return null;
  return {
    purchaseCostBdt:
      row.purchaseCostBdt != null ? round2(Number(row.purchaseCostBdt)) : null,
    projectedSaleBdt:
      row.projectedSaleBdt != null ? round2(Number(row.projectedSaleBdt)) : null,
    notes: row.notes,
  };
}
