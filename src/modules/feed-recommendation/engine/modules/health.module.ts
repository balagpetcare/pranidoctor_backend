import type { RuleModule } from '../../feed-recommendation.types.js';
import { addExplanation, matchesDiseaseKeywords } from '../engine-utils.js';

export const healthModule: RuleModule = {
  id: 'health-status',
  nameBn: 'স্বাস্থ্য অবস্থা',
  apply(state) {
    const mod = state.rules.modifiers.healthStatus[state.input.healthStatus];
    if (!mod) return state;

    let allocation = { ...state.allocation };
    if (mod.concentrateMultiplier != null && allocation.CONCENTRATE != null) {
      allocation.CONCENTRATE *= mod.concentrateMultiplier;
    }

    const warnings = mod.warningBn
      ? [...state.warnings, mod.warningBn]
      : state.warnings;

    const healthSafetyScore =
      state.input.healthStatus === 'HEALTHY'
        ? 100
        : state.input.healthStatus === 'SICK'
          ? 40
          : 70;

    return addExplanation(
      {
        ...state,
        allocation,
        warnings,
        healthSafetyScore,
      },
      'health-status',
      'স্বাস্থ্য',
      `status=${state.input.healthStatus}`,
      mod.warningBn ?? 'স্বাস্থ্য অনুযায়ী খাদ্য সামঞ্জস্য',
    );
  },
};

export const diseaseModule: RuleModule = {
  id: 'disease-aware',
  nameBn: 'রোগ-সচেতন',
  apply(state) {
    if (state.context.recentDiseaseKeywords.length === 0) return state;

    let next = { ...state };
    const corpus = state.context.recentDiseaseKeywords.join(' ').toLowerCase();

    for (const rule of state.rules.diseaseRules) {
      if (!matchesDiseaseKeywords(corpus, rule.matchKeywords)) continue;

      let allocation = { ...next.allocation };
      if (rule.concentrateMultiplier != null && allocation.CONCENTRATE != null) {
        allocation.CONCENTRATE *= rule.concentrateMultiplier;
      }
      if (rule.greenMultiplier != null && allocation.GREEN != null) {
        allocation.GREEN *= rule.greenMultiplier;
      }
      if (rule.mineralBoostPercent != null && allocation.MINERAL != null) {
        allocation.MINERAL *= 1 + rule.mineralBoostPercent / 100;
      }

      next = {
        ...next,
        allocation,
        warnings: [...next.warnings, rule.warningBn],
        healthSafetyScore: Math.min(next.healthSafetyScore, 55),
      };
      next = addExplanation(
        next,
        `disease-${rule.id}`,
        'রোগ-সচেতন',
        rule.id,
        rule.warningBn,
      );
    }

    return next;
  },
};
