import type { RuleModule } from '../../feed-recommendation.types.js';
import { addExplanation } from '../engine-utils.js';

/** Lactation / milk production DM add-on and concentrate boost. */
export const lactationModule: RuleModule = {
  id: 'lactation',
  nameBn: 'দুধ উৎপাদন',
  apply(state) {
    const { lactation } = state.rules;
    if (!lactation.enabledSpecies.includes(state.input.species)) return state;
    if (state.input.purpose !== 'DAIRY') return state;

    let next = { ...state };
    const milkLiters =
      state.context.estimatedDailyMilkLiters
      ?? lactation.defaultDailyMilkLiters[state.input.species]
      ?? 0;

    if (milkLiters > 0) {
      const extraDm = milkLiters * lactation.dmPerLiterMilk;
      next.totalDmKg += extraDm;
      next = addExplanation(
        next,
        'lactation-dm',
        'দুধ উৎপাদন',
        `extraDm = milkL × ${lactation.dmPerLiterMilk}`,
        `দুধ ${milkLiters}L — অতিরিক্ত ${extraDm.toFixed(2)} kg শুষ্ক পদার্থ`,
      );
    }

    const days = state.context.lastCalvingDate
      ? Math.floor(
          (state.planDate.getTime() - state.context.lastCalvingDate.getTime())
            / (86400000),
        )
      : null;

    if (days == null) return next;

    const { phases } = lactation;
    if (days > (phases.late?.maxDays ?? 305)) {
      const dry = phases.dry;
      if (dry?.concentrateMultiplier != null && next.allocation.CONCENTRATE != null) {
        next.allocation = {
          ...next.allocation,
          CONCENTRATE: next.allocation.CONCENTRATE * dry.concentrateMultiplier,
        };
        if (dry.warningBn) next.warnings.push(dry.warningBn);
      }
      return addExplanation(
        next,
        'lactation-dry',
        'শুকনো সময়',
        'concentrate × dryMultiplier',
        dry?.warningBn ?? 'শুকনো সময় — ক্ষুধাহানিক কমেছে',
      );
    }

    let phase = phases.late;
    if (days <= (phases.early?.maxDays ?? 100)) phase = phases.early;
    else if (days <= (phases.mid?.maxDays ?? 200)) phase = phases.mid;

    if (phase?.concentrateBoostPercent != null && next.allocation.CONCENTRATE != null) {
      next.allocation = {
        ...next.allocation,
        CONCENTRATE:
          next.allocation.CONCENTRATE
          * (1 + phase.concentrateBoostPercent / 100),
      };
    }
    if (phase?.cpBoostPercent != null) {
      next.cpTargetPercent += phase.cpBoostPercent;
    }

    return addExplanation(
      next,
      'lactation-phase',
      'দুধ উৎপাদন',
      `daysSinceCalving=${days}`,
      `দুধ উৎপাদন পর্যায় — ক্ষুধাহানিক বাড়ানো`,
    );
  },
};
