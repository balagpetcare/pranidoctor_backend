import type { RuleModule } from '../../feed-recommendation.types.js';
import { addExplanation } from '../engine-utils.js';

export const pregnancyModule: RuleModule = {
  id: 'pregnancy',
  nameBn: 'গর্ভকাল',
  apply(state) {
    if (state.input.pregnancyStatus !== 'PREGNANT') return state;
    if (state.input.gender !== 'FEMALE' && state.input.gender !== 'UNKNOWN') {
      return state;
    }

    const mod = state.rules.modifiers.pregnancyStatus.PREGNANT;
    if (!mod) return state;

    let allocation = { ...state.allocation };
    if (mod.concentrateBoostPercent != null && allocation.CONCENTRATE != null) {
      allocation.CONCENTRATE *= 1 + mod.concentrateBoostPercent / 100;
    }
    if (mod.mineralBoostPercent != null && allocation.MINERAL != null) {
      allocation.MINERAL *= 1 + mod.mineralBoostPercent / 100;
    }

    const warnings = mod.warningBn
      ? [...state.warnings, mod.warningBn]
      : state.warnings;

    return addExplanation(
      {
        ...state,
        allocation,
        warnings,
        healthSafetyScore: Math.min(state.healthSafetyScore, 90),
      },
      'pregnancy',
      'গর্ভকাল',
      'concentrate + mineral boost',
      mod.warningBn ?? 'গর্ভকাল — পুষ্টি বাড়ানো হয়েছে',
    );
  },
};
