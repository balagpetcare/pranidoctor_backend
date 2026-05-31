import { describe, expect, it } from 'vitest';

import { evaluateEligibility } from './engines/eligibility.engine.js';
import { computeBoosterStatuses } from './engines/booster.engine.js';
import { detectMissedVaccines } from './engines/missed-vaccine.engine.js';
import { buildReminderRecommendations } from './engines/reminder.engine.js';
import { classifyVaccineIntent } from './engines/vaccine-intent.engine.js';
import {
  computeVaccineSessionConfidence,
  tierFromScore,
  confidenceBadgeLabel,
} from './engines/vaccine-confidence.engine.js';
import {
  resolveVaccineEscalationType,
} from './engines/vaccine-escalation.engine.js';
import { buildVaccineSafetyReport } from './engines/vaccine-safety-report.engine.js';
import { parseAgeWindowDays } from './engines/vaccine-metadata.util.js';
import type { ScheduleRow } from './ai-vaccine.types.js';

function scheduleRow(overrides: Partial<ScheduleRow> & { slug: string }): ScheduleRow {
  return {
    slug: overrides.slug,
    titleBn: overrides.titleBn ?? overrides.slug,
    titleEn: overrides.titleEn ?? overrides.slug,
    antigen: overrides.antigen ?? 'FMD',
    ageWindow: overrides.ageWindow ?? '৩–৬ মাস',
    boosterIntervalDays: overrides.boosterIntervalDays ?? 180,
    route: 'IM/SC',
    citations: overrides.citations ?? [
      {
        token: `[cite:${overrides.slug}]`,
        entityId: 'ent-1',
        slug: overrides.slug,
        sourceKey: 'dls-vaccination-calendar-bd',
        evidenceLevel: 'L2',
      },
    ],
    confidenceScore: overrides.confidenceScore ?? 0.75,
  };
}

describe('vaccine eligibility engine', () => {
  it('marks age within published window as IN_WINDOW', () => {
    const schedules = [scheduleRow({ slug: 'cattle-fmd-schedule', antigen: 'FMD' })];
    const results = evaluateEligibility({ schedules, ageDays: 120 });
    expect(results[0]?.status).toBe('IN_WINDOW');
    expect(results[0]?.citations.length).toBeGreaterThan(0);
    expect(results[0]?.vetConfirmRequired).toBe(true);
  });

  it('returns UNKNOWN when age missing', () => {
    const schedules = [scheduleRow({ slug: 'cattle-fmd-schedule' })];
    const results = evaluateEligibility({ schedules });
    expect(results[0]?.status).toBe('UNKNOWN');
  });

  it('parses Bangla age window to day bounds', () => {
    const bounds = parseAgeWindowDays('৩–৬ মাস');
    expect(bounds.minDays).toBe(90);
    expect(bounds.maxDays).toBe(180);
  });
});

describe('vaccine booster engine', () => {
  it('uses nextDueDate from record when set', () => {
    const schedules = [scheduleRow({ slug: 'cattle-fmd-schedule', boosterIntervalDays: 180 })];
    const nextDue = new Date();
    nextDue.setUTCDate(nextDue.getUTCDate() + 5);
    const boosters = computeBoosterStatuses({
      schedules,
      entries: [],
      history: [
        {
          id: 'v2',
          vaccineName: 'FMD',
          administeredDate: new Date(),
          scheduledDate: new Date(),
          nextDueDate: nextDue,
        },
      ],
      vaccineSlugs: ['cattle-fmd-schedule'],
    });
    expect(boosters[0]?.dueInDays).toBe(5);
  });

  it('computes next due from administered date and interval', () => {
    const schedules = [scheduleRow({ slug: 'cattle-fmd-schedule', boosterIntervalDays: 180 })];
    const last = new Date();
    last.setUTCDate(last.getUTCDate() - 100);
    const boosters = computeBoosterStatuses({
      schedules,
      entries: [],
      history: [
        {
          id: 'v1',
          vaccineName: 'FMD vaccine',
          administeredDate: last,
          scheduledDate: last,
          nextDueDate: null,
        },
      ],
      vaccineSlugs: ['cattle-fmd-schedule'],
    });
    expect(boosters.length).toBeGreaterThan(0);
    expect(boosters[0]?.boosterIntervalDays).toBe(180);
    expect(boosters[0]?.nextDueDate).toBeDefined();
    expect(boosters[0]?.citations.length).toBeGreaterThan(0);
  });
});

describe('missed vaccine detection', () => {
  it('flags overdue records with citations', () => {
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 14);
    const alerts = detectMissedVaccines({
      history: [
        {
          id: 'v1',
          vaccineName: 'FMD',
          administeredDate: null,
          scheduledDate: past,
          nextDueDate: null,
        },
      ],
      schedules: [scheduleRow({ slug: 'cattle-fmd-schedule', antigen: 'FMD' })],
      entries: [],
      locale: 'bn',
    });
    expect(alerts.length).toBe(1);
    expect(alerts[0]?.severity).not.toBe('INFO');
  });
});

describe('vaccine reminders', () => {
  it('includes safety footer on reminders', () => {
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 7);
    const reminders = buildReminderRecommendations({
      boosters: [
        {
          vaccineSlug: 'cattle-fmd-schedule',
          antigen: 'FMD',
          nextDueDate: due.toISOString().slice(0, 10),
          dueInDays: 7,
          overdue: false,
          boosterIntervalDays: 180,
          citations: [
            {
              token: '[cite:cattle-fmd-schedule]',
              entityId: 'e1',
              slug: 'cattle-fmd-schedule',
              sourceKey: 'dls',
              evidenceLevel: 'L2',
            },
          ],
          confidenceScore: 0.8,
        },
      ],
      schedules: [scheduleRow({ slug: 'cattle-fmd-schedule' })],
      confidenceTier: 'STRONG',
    });
    expect(reminders.length).toBeGreaterThan(0);
    expect(reminders[0]?.safetyFooterBn).toContain('পশুচিকিৎসক');
    expect(reminders[0]?.citations.length).toBeGreaterThan(0);
  });
});

describe('vaccine intent router', () => {
  it('redirects diagnosis intent away from vaccine assistant', () => {
    const result = classifyVaccineIntent('আমার গরুর রোগ কী?');
    expect(result.intent).toBe('DIAGNOSIS');
    expect(result.redirectAssistant).toBe('ai-doctor');
    expect(result.blockInVaccine).toBe(true);
  });

  it('classifies schedule questions', () => {
    const result = classifyVaccineIntent('গরুর FMD টিকা কখন দেব?');
    expect(result.intent).toBe('SCHEDULE');
  });
});

describe('vaccine confidence and escalation', () => {
  it('tiers scores for farmer display', () => {
    expect(tierFromScore(0.75)).toBe('STRONG');
    expect(tierFromScore(0.55)).toBe('LIMITED');
    expect(confidenceBadgeLabel('STRONG', 'bn')).toContain('জাতীয়');
  });

  it('escalates on CRITICAL safety', () => {
    const report = buildVaccineSafetyReport({
      entries: [],
      eligibility: [],
      missedAlerts: [],
      boosters: [],
      pregnancy: false,
      interactions: {
        vaccineConflicts: [],
        medicineConflicts: [],
        overallRisk: 'CRITICAL',
      },
    });
    const confidence = computeVaccineSessionConfidence({
      safetyReport: report,
      hasScheduleFacts: true,
    });
    const type = resolveVaccineEscalationType({ safetyReport: report, confidence });
    expect(type).toBe('VET_CALL_NOW');
    expect(report.escalationRequired).toBe(true);
  });
});
