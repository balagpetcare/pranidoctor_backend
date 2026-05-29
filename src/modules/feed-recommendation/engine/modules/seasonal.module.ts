import type { RuleModule } from '../../feed-recommendation.types.js';
import { addExplanation } from '../engine-utils.js';

export const youngAnimalModule: RuleModule = {
  id: 'young-animal',
  nameBn: 'বাচ্চা পশু',
  apply(state) {
    const { modifiers } = state.rules;
    if (
      state.input.ageMonths == null
      || state.input.ageMonths > modifiers.youngAnimalMonths
    ) {
      return state;
    }

    let allocation = { ...state.allocation };
    if (allocation.CONCENTRATE != null) {
      allocation.CONCENTRATE *=
        1 + modifiers.youngAnimalConcentrateBoostPercent / 100;
    }

    return addExplanation(
      {
        ...state,
        allocation,
        warnings: [
          ...state.warnings,
          'বাচ্চা পশু — বৃদ্ধির জন্য ক্ষুধাহানিক বাড়ান',
        ],
      },
      'young-animal',
      'বাচ্চা পশু',
      `ageMonths ≤ ${modifiers.youngAnimalMonths}`,
      'বৃদ্ধির জন্য ক্ষুধাহানিক বাড়ানো হয়েছে',
    );
  },
};

export const seasonalModule: RuleModule = {
  id: 'seasonal',
  nameBn: 'মৌসুমি',
  apply(state) {
    const month = state.planDate.getUTCMonth() + 1;
    let allocation = { ...state.allocation };
    let seasonalFitScore = 80;
    let warnings = [...state.warnings];
    let next = state;

    for (const [seasonId, season] of Object.entries(state.rules.seasonal)) {
      if (!season.months.includes(month)) continue;

      if (season.warningBn) warnings.push(season.warningBn);

      if (season.allocationShift) {
        for (const [cat, delta] of Object.entries(season.allocationShift)) {
          if (allocation[cat] != null) {
            allocation[cat] = Math.max(0, allocation[cat]! + delta);
          }
        }
        seasonalFitScore = 95;
      }

      next = addExplanation(
        next,
        `seasonal-${seasonId}`,
        'মৌসুমি',
        seasonId,
        season.warningBn,
      );
    }

    return { ...next, allocation, warnings, seasonalFitScore };
  },
};
