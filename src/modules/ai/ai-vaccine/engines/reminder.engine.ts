import { randomUUID } from 'node:crypto';

import { VACCINE_REMINDER_LEAD_DAYS } from '../ai-vaccine.constants.js';
import type { BoosterStatus, ScheduleRow, VaccinationReminder } from '../ai-vaccine.types.js';
import type { ConfidenceTier } from '../ai-vaccine.types.js';

const SAFETY_FOOTER_BN =
  'টিকা প্রয়োগের আগে অবশ্যই লাইসেন্সপ্রাপ্ত পশুচিকিৎসকের পরামর্শ নিন। এটি রোগ নির্ণয় নয়।';

export function buildReminderRecommendations(params: {
  boosters: BoosterStatus[];
  schedules: ScheduleRow[];
  livestockId?: string;
  confidenceTier: ConfidenceTier;
}): VaccinationReminder[] {
  const reminders: VaccinationReminder[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const booster of params.boosters) {
    if (!booster.nextDueDate) continue;
    const due = new Date(booster.nextDueDate);
    due.setUTCHours(0, 0, 0, 0);
    const daysUntil = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    const shouldRemind = VACCINE_REMINDER_LEAD_DAYS.some(
      (lead) => daysUntil === lead || (booster.overdue && daysUntil < 0 && Math.abs(daysUntil) % 7 === 0),
    );
    if (!shouldRemind && !booster.overdue) continue;

    const schedule =
      params.schedules.find((s) => s.slug === booster.vaccineSlug || s.antigen === booster.antigen) ??
      params.schedules[0];
    const antigen = booster.antigen ?? schedule?.antigen ?? booster.vaccineSlug;

    const messageBn = booster.overdue
      ? `${antigen} বুস্টার টিকা ${booster.nextDueDate} তারিখে নির্ধারিত ছিল — ভেটের সাথে যোগাযোগ করুন।`
      : `${antigen} বুস্টার টিকা প্রায় ${daysUntil} দিনের মধ্যে (${booster.nextDueDate}) — ভেটের সাথে পরিকল্পনা করুন।`;
    const messageEn = booster.overdue
      ? `${antigen} booster was due ${booster.nextDueDate}. Contact your veterinarian.`
      : `${antigen} booster due in ~${daysUntil} days (${booster.nextDueDate}). Plan with your vet.`;

    reminders.push({
      id: randomUUID(),
      ...(params.livestockId !== undefined ? { livestockId: params.livestockId } : {}),
      scheduleSlug: schedule?.slug ?? booster.vaccineSlug,
      dueDate: booster.nextDueDate,
      channel: 'IN_APP',
      messageBn,
      messageEn,
      citations: booster.citations,
      confidenceTier: params.confidenceTier,
      safetyFooterBn: SAFETY_FOOTER_BN,
    });
  }

  return reminders;
}
