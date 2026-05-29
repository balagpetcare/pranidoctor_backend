import type { RuleModule } from '../../feed-recommendation.types.js';
import {
  addExplanation,
  resolveAllocation,
  resolveNutritionTargets,
} from '../engine-utils.js';

/** Base dry matter requirement from body weight. */
export const dmBaseModule: RuleModule = {
  id: 'dm-base',
  nameBn: 'মৌলিক শুষ্ক পদার্থ',
  apply(state) {
    const speciesKey = state.input.species;
    const dmPercent =
      state.rules.baseDmPercentOfBodyWeight[speciesKey]
      ?? state.rules.baseDmPercentOfBodyWeight.default
      ?? 0.03;

    const totalDmKg = state.input.weightKg * dmPercent;
    const targets = resolveNutritionTargets(
      state.rules,
      speciesKey,
      state.input.purpose,
    );
    const allocation = resolveAllocation(
      state.rules,
      speciesKey,
      state.input.purpose,
    );

    return addExplanation(
      {
        ...state,
        totalDmKg,
        allocation,
        cpTargetPercent: targets.cpPercent,
        tdnTargetPercent: targets.tdnPercent,
      },
      'dm-base',
      'মৌলিক শুষ্ক পদার্থ',
      `totalDmKg = weight × ${(dmPercent * 100).toFixed(1)}%`,
      `দৈনিক শুষ্ক পদার্থ ${totalDmKg.toFixed(2)} kg (CP লক্ষ্য ${targets.cpPercent}%)`,
    );
  },
};
