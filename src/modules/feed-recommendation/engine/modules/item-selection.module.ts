import type { FeedCategory } from '@/generated/prisma/client';

import type { EnginePipelineState, RecommendationAlternative } from '../../feed-recommendation.types.js';
import type { RuleModule } from '../../feed-recommendation.types.js';
import {
  itemsInCategory,
  normalizeAllocation,
  round2,
  round3,
  scoreFeedItem,
} from '../engine-utils.js';

function isMonsoonMonth(month: number, rules: EnginePipelineState['rules']): boolean {
  return rules.seasonal.monsoon?.months.includes(month) ?? false;
}

/** Score-based item pick per category + low-cost alternatives. */
export const itemSelectionModule: RuleModule = {
  id: 'item-selection',
  nameBn: 'খাদ্য নির্বাচন',
  apply(state) {
    const allocation = normalizeAllocation(state.allocation);
    const month = state.planDate.getUTCMonth() + 1;
    const monsoon = isMonsoonMonth(month, state.rules);
    const { bangladeshContext, scoringWeights, affordability } = state.rules;

    const selectedItems: EnginePipelineState['selectedItems'] = [];
    const alternatives: RecommendationAlternative[] = [];
    let estimatedCostBdt = 0;

    for (const [category, fraction] of Object.entries(allocation)) {
      if (fraction <= 0) continue;

      const candidates = itemsInCategory(state.feedItems, category as FeedCategory);
      if (candidates.length === 0) {
        state.warnings.push(`${category} বিভাগে সক্রিয় খাদ্য পাওয়া যায়নি`);
        continue;
      }

      const maxPrice = Math.max(
        ...candidates.map((c) => c.approxPriceBdt ?? 0),
        1,
      );

      const scored = candidates
        .map((item) => ({
          item,
          score: scoreFeedItem({
            item,
            category,
            species: state.input.species,
            month,
            weights: scoringWeights,
            maxPriceInCategory: maxPrice,
            preferredCodes: bangladeshContext.preferredCodes,
            monsoonRoughageCodes: bangladeshContext.monsoonRoughageCodes,
            cpTarget: state.cpTargetPercent,
            tdnTarget: state.tdnTargetPercent,
            isMonsoon: monsoon,
          }),
        }))
        .sort((a, b) => b.score - a.score);

      const winner = scored[0]!;
      const amountKg = round3(state.totalDmKg * fraction);
      if (amountKg <= 0) continue;

      const unitPrice = winner.item.approxPriceBdt ?? 0;
      const costBdt = round2(amountKg * unitPrice);
      estimatedCostBdt += costBdt;

      selectedItems.push({
        feedItemId: winner.item.id,
        nameBn: winner.item.nameBn,
        amountKg,
        costBdt,
        itemScore: round2(winner.score),
      });

      const minScore = winner.score * affordability.alternativeMinScoreRatio;
      const cheaper = scored.find(
        (s) =>
          s.item.id !== winner.item.id
          && s.score >= minScore
          && (s.item.approxPriceBdt ?? 0) < unitPrice,
      );

      if (cheaper) {
        const altCost = round2(amountKg * (cheaper.item.approxPriceBdt ?? 0));
        alternatives.push({
          originalFeedItemId: winner.item.id,
          alternativeFeedItemId: cheaper.item.id,
          nameBn: cheaper.item.nameBn,
          savingsBdt: round2(costBdt - altCost),
          tradeoffBn: `সাশ্রয়ী বিকল্প — পুষ্টি স্কোর ${cheaper.score.toFixed(0)} (মূল ${winner.score.toFixed(0)})`,
        });
      }
    }

    if (selectedItems.length === 0) {
      state.warnings.push('কোনো খাদ্য আইটেম মেলেনি — মাস্টার ক্যাটালগ সিড করুন');
    }

    const budget =
      state.context.budgetBdt ?? affordability.maxBudgetBdtDefault ?? null;
    const warnings = [...state.warnings];
    if (budget != null && estimatedCostBdt > budget) {
      warnings.push(
        `দৈনিক বাজেট ৳${budget} — অনুমানিত খরচ ৳${estimatedCostBdt.toFixed(0)}`,
      );
    }
    if (
      affordability.lowCostWarningThresholdBdt != null
      && estimatedCostBdt > affordability.lowCostWarningThresholdBdt
      && alternatives.length > 0
    ) {
      warnings.push('কম খরচের বিকল্প উপলব্ধ — নিচে দেখুন');
    }

    return {
      ...state,
      allocation,
      selectedItems,
      alternatives,
      warnings,
    };
  },
};

export const nutritionAchievedModule: RuleModule = {
  id: 'nutrition-achieved',
  nameBn: 'পুষ্টি হিসাব',
  apply(state) {
    void state;
    return state;
  },
};
