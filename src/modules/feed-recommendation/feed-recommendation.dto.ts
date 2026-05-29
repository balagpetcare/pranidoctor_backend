import type {
  RecommendationItem,
  RecommendationResult,
  RecommendationTotals,
} from './feed-recommendation.types.js';

export type FeedRecommendationDto = RecommendationResult & {
  livestockId?: string;
  logId?: string;
  accepted?: boolean;
};

export type {
  RecommendationAlternative,
  RecommendationExplanation,
  RecommendationIntelligencePayload,
  RecommendationScoreBreakdown,
} from './feed-recommendation.types.js';

export type FeedRecommendationHistoryItemDto = {
  id: string;
  livestockId: string;
  planDate: string;
  ruleVersion: string;
  accepted: boolean;
  totals: RecommendationTotals;
  createdAt: string;
};

export function toFeedRecommendationDto(
  result: RecommendationResult,
  extras?: { livestockId?: string; logId?: string; accepted?: boolean },
): FeedRecommendationDto {
  return {
    ...result,
    ...(extras?.livestockId ? { livestockId: extras.livestockId } : {}),
    ...(extras?.logId ? { logId: extras.logId } : {}),
    ...(extras?.accepted != null ? { accepted: extras.accepted } : {}),
  };
}

export function toHistoryItemDto(row: {
  id: string;
  livestockId: string;
  planDate: Date;
  ruleVersion: string;
  accepted: boolean;
  totalsJson: unknown;
  createdAt: Date;
}): FeedRecommendationHistoryItemDto {
  const totals = row.totalsJson as RecommendationTotals;
  return {
    id: row.id,
    livestockId: row.livestockId,
    planDate: row.planDate.toISOString().slice(0, 10),
    ruleVersion: row.ruleVersion,
    accepted: row.accepted,
    totals,
    createdAt: row.createdAt.toISOString(),
  };
}

export type { RecommendationItem, RecommendationTotals };
