import { LivestockVaccinationStatus } from '../../../../generated/prisma/index.js';

import { VACCINE_CORE_ANTIGENS } from '../ai-vaccine.constants.js';
import type { MissedVaccineAlert, ScheduleRow } from '../ai-vaccine.types.js';
import type { VaccinationHistoryRow } from './booster.engine.js';
import { parseVaccineStructured, type PublishedVaccineEntry } from './vaccine-metadata.util.js';

function startOfDayUtc(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function computeStatus(
  scheduledDate: Date,
  administeredDate: Date | null,
): LivestockVaccinationStatus {
  if (administeredDate) return LivestockVaccinationStatus.COMPLETED;
  const today = startOfDayUtc(new Date());
  if (scheduledDate.getTime() < today.getTime()) return LivestockVaccinationStatus.OVERDUE;
  const diffDays = (scheduledDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDays <= 7) return LivestockVaccinationStatus.DUE;
  return LivestockVaccinationStatus.SCHEDULED;
}

function resolveAntigen(
  vaccineName: string,
  schedules: ScheduleRow[],
  entries: PublishedVaccineEntry[],
): string | undefined {
  const lower = vaccineName.toLowerCase();
  for (const s of schedules) {
    if (s.antigen && lower.includes(s.antigen.toLowerCase())) return s.antigen;
  }
  for (const e of entries) {
    const antigen = parseVaccineStructured(e.metadataJson).antigen;
    if (antigen && lower.includes(antigen.toLowerCase())) return antigen;
  }
  return undefined;
}

export function detectMissedVaccines(params: {
  history: VaccinationHistoryRow[];
  schedules: ScheduleRow[];
  entries: PublishedVaccineEntry[];
  locale: 'bn' | 'en';
}): MissedVaccineAlert[] {
  const today = startOfDayUtc(new Date());
  const alerts: MissedVaccineAlert[] = [];

  for (const row of params.history) {
    const status = computeStatus(row.scheduledDate, row.administeredDate);
    if (status !== LivestockVaccinationStatus.OVERDUE && status !== LivestockVaccinationStatus.DUE) {
      continue;
    }

    const scheduled = startOfDayUtc(row.scheduledDate);
    const overdueDays = Math.floor((today.getTime() - scheduled.getTime()) / (24 * 60 * 60 * 1000));
    const antigen = resolveAntigen(row.vaccineName, params.schedules, params.entries);
    const schedule = params.schedules.find((s) => s.antigen === antigen);
    const citations = schedule?.citations ?? [];

    let severity: MissedVaccineAlert['severity'] = 'INFO';
    if (status === LivestockVaccinationStatus.OVERDUE) {
      if (antigen && VACCINE_CORE_ANTIGENS.has(antigen) && overdueDays >= 30) {
        severity = 'HIGH';
      } else if (overdueDays >= 30) {
        severity = 'WARNING';
      } else if (overdueDays >= 7) {
        severity = 'WARNING';
      } else {
        severity = 'INFO';
      }
    } else {
      severity = 'INFO';
    }

    const messageBn =
      status === LivestockVaccinationStatus.OVERDUE
        ? `${row.vaccineName} টিকার নির্ধারিত তারিখ (${scheduled.toISOString().slice(0, 10)}) পেরিয়ে গেছে। পশুচিকিৎসকের পরামর্শ নিন।`
        : `${row.vaccineName} টিকা শীঘ্রই (${scheduled.toISOString().slice(0, 10)}) — ভেটের সাথে পরিকল্পনা করুন।`;
    const messageEn =
      status === LivestockVaccinationStatus.OVERDUE
        ? `${row.vaccineName} vaccination was due on ${scheduled.toISOString().slice(0, 10)}. Consult your veterinarian.`
        : `${row.vaccineName} vaccination is due soon (${scheduled.toISOString().slice(0, 10)}). Plan with your vet.`;

    alerts.push({
      vaccinationRecordId: row.id,
      vaccineName: row.vaccineName,
      scheduledDate: scheduled.toISOString().slice(0, 10),
      severity,
      messageBn,
      messageEn,
      ...(schedule?.slug !== undefined ? { scheduleSlug: schedule.slug } : {}),
      citations,
    });
  }

  return alerts.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
    return order[a.severity] - order[b.severity];
  });
}
