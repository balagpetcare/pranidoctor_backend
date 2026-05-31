import { omitUndefined } from '../../../../shared/types/object.utils.js';
import type { ScheduleRow, EligibilityResult } from '../ai-vaccine.types.js';
import { parseAgeWindowDays } from './vaccine-metadata.util.js';

export function evaluateEligibility(params: {
  schedules: ScheduleRow[];
  ageDays?: number;
}): EligibilityResult[] {
  if (params.ageDays === undefined) {
    return params.schedules.map((schedule) => ({
      status: 'UNKNOWN',
      scheduleSlug: schedule.slug,
      ageWindowDisplayBn: schedule.ageWindow ?? schedule.titleBn,
      citations: schedule.citations,
      confidenceScore: schedule.confidenceScore * 0.5,
      vetConfirmRequired: true,
    }));
  }

  const ageDays = params.ageDays;
  return params.schedules.map((schedule) => {
    const bounds = parseAgeWindowDays(
      schedule.ageWindow,
      omitUndefined({
        ageWindow: schedule.ageWindow,
        boosterIntervalDays: schedule.boosterIntervalDays,
      }),
    );
    const display = schedule.ageWindow ?? schedule.titleBn;

    if (bounds.minDays === undefined && bounds.maxDays === undefined) {
      return {
        status: 'UNKNOWN',
        scheduleSlug: schedule.slug,
        ageDays,
        ageWindowDisplayBn: display,
        citations: schedule.citations,
        confidenceScore: schedule.confidenceScore * 0.7,
        vetConfirmRequired: true,
      };
    }

    const min = bounds.minDays ?? 0;
    const max = bounds.maxDays ?? min + 60;

    if (ageDays < min - 14) {
      return {
        status: 'NOT_ELIGIBLE',
        scheduleSlug: schedule.slug,
        ageDays,
        ageWindowDisplayBn: display,
        citations: schedule.citations,
        confidenceScore: schedule.confidenceScore,
        vetConfirmRequired: true,
      };
    }
    if (ageDays < min) {
      return {
        status: 'APPROACHING',
        scheduleSlug: schedule.slug,
        ageDays,
        ageWindowDisplayBn: display,
        citations: schedule.citations,
        confidenceScore: schedule.confidenceScore,
        vetConfirmRequired: true,
      };
    }
    if (ageDays <= max) {
      return {
        status: 'IN_WINDOW',
        scheduleSlug: schedule.slug,
        ageDays,
        ageWindowDisplayBn: display,
        citations: schedule.citations,
        confidenceScore: schedule.confidenceScore,
        vetConfirmRequired: true,
      };
    }
    return {
      status: 'OVERDUE_PRIMARY',
      scheduleSlug: schedule.slug,
      ageDays,
      ageWindowDisplayBn: display,
      citations: schedule.citations,
      confidenceScore: schedule.confidenceScore * 0.85,
      vetConfirmRequired: true,
    };
  });
}
