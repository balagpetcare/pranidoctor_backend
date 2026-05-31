import type { BoosterStatus, ScheduleRow } from '../ai-vaccine.types.js';
import type { PublishedVaccineEntry } from './vaccine-metadata.util.js';
import { parseVaccineStructured } from './vaccine-metadata.util.js';

export type VaccinationHistoryRow = {
  id: string;
  vaccineName: string;
  administeredDate: Date | null;
  scheduledDate: Date;
  nextDueDate: Date | null;
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function matchScheduleForRecord(
  record: VaccinationHistoryRow,
  schedules: ScheduleRow[],
  entries: PublishedVaccineEntry[],
): ScheduleRow | undefined {
  const name = record.vaccineName.toLowerCase();
  for (const schedule of schedules) {
    const antigen = schedule.antigen?.toLowerCase() ?? '';
    if (antigen && name.includes(antigen.toLowerCase())) return schedule;
    if (name.includes(schedule.slug.replace(/-schedule$/, ''))) return schedule;
  }
  for (const entry of entries) {
    const structured = parseVaccineStructured(entry.metadataJson);
    const antigen = structured.antigen?.toLowerCase() ?? '';
    if (antigen && name.includes(antigen)) {
      return schedules.find((s) => s.slug === entry.slug || s.antigen === structured.antigen);
    }
  }
  return undefined;
}

export function computeBoosterStatuses(params: {
  schedules: ScheduleRow[];
  entries: PublishedVaccineEntry[];
  history: VaccinationHistoryRow[];
  vaccineSlugs: string[];
}): BoosterStatus[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const results: BoosterStatus[] = [];

  const slugSet = new Set(params.vaccineSlugs);
  for (const slug of params.vaccineSlugs) {
    const entry = params.entries.find((e) => e.slug === slug);
    const schedule =
      params.schedules.find((s) => s.slug === slug || s.antigen === parseVaccineStructured(entry?.metadataJson).antigen) ??
      params.schedules.find((s) => slug.includes(s.antigen ?? '___'));
    if (!schedule) continue;
    const interval = schedule.boosterIntervalDays;
    const hist = params.history.find((h) => {
      const match = matchScheduleForRecord(h, [schedule], params.entries);
      return match?.slug === schedule.slug;
    });
    if (interval === undefined) {
      results.push({
        vaccineSlug: slug,
        ...(schedule.antigen !== undefined ? { antigen: schedule.antigen } : {}),
        overdue: false,
        citations: schedule.citations,
        confidenceScore: schedule.confidenceScore * 0.6,
      });
      continue;
    }

    if (hist?.nextDueDate) {
      const nextDue = new Date(hist.nextDueDate);
      nextDue.setUTCHours(0, 0, 0, 0);
      const dueInDays = daysBetween(today, nextDue);
      results.push({
        vaccineSlug: slug,
        ...(schedule.antigen !== undefined ? { antigen: schedule.antigen } : {}),
        ...(hist.administeredDate
          ? { lastAdministeredDate: new Date(hist.administeredDate).toISOString().slice(0, 10) }
          : {}),
        nextDueDate: nextDue.toISOString().slice(0, 10),
        dueInDays,
        overdue: dueInDays < 0,
        boosterIntervalDays: interval,
        citations: schedule.citations,
        confidenceScore: schedule.confidenceScore,
      });
      continue;
    }

    if (!hist?.administeredDate) {
      results.push({
        vaccineSlug: slug,
        ...(schedule.antigen !== undefined ? { antigen: schedule.antigen } : {}),
        overdue: false,
        boosterIntervalDays: interval,
        citations: schedule.citations,
        confidenceScore: schedule.confidenceScore * 0.6,
      });
      continue;
    }
    const last = new Date(hist.administeredDate);
    last.setUTCHours(0, 0, 0, 0);
    const nextDue = new Date(last);
    nextDue.setUTCDate(nextDue.getUTCDate() + interval);
    const dueInDays = daysBetween(today, nextDue);
    results.push({
      vaccineSlug: slug,
      ...(schedule.antigen !== undefined ? { antigen: schedule.antigen } : {}),
      lastAdministeredDate: last.toISOString().slice(0, 10),
      nextDueDate: nextDue.toISOString().slice(0, 10),
      dueInDays,
      overdue: dueInDays < 0,
      boosterIntervalDays: interval,
      citations: schedule.citations,
      confidenceScore: schedule.confidenceScore,
    });
  }

  if (results.length === 0 && params.history.length > 0) {
    for (const row of params.history) {
      if (!row.administeredDate) continue;
      const schedule = matchScheduleForRecord(row, params.schedules, params.entries);
      if (!schedule?.boosterIntervalDays) continue;
      const key = schedule.slug;
      if (slugSet.has(key)) continue;
      const last = new Date(row.administeredDate);
      last.setUTCHours(0, 0, 0, 0);
      const nextDue = new Date(last);
      nextDue.setUTCDate(nextDue.getUTCDate() + schedule.boosterIntervalDays);
      const dueInDays = daysBetween(today, nextDue);
      results.push({
        vaccineSlug: schedule.slug,
        ...(schedule.antigen !== undefined ? { antigen: schedule.antigen } : {}),
        lastAdministeredDate: last.toISOString().slice(0, 10),
        nextDueDate: nextDue.toISOString().slice(0, 10),
        dueInDays,
        overdue: dueInDays < 0,
        boosterIntervalDays: schedule.boosterIntervalDays,
        citations: schedule.citations,
        confidenceScore: schedule.confidenceScore,
      });
    }
  }

  return results;
}
