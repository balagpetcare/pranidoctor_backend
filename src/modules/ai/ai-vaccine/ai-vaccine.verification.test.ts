import { describe, expect, it } from 'vitest';

import {
  VACCINE_FAIL_CLOSED_CONFIDENCE,
  VACCINE_MIN_CONFIDENCE,
  VACCINE_SCHEDULE_MIN_CONFIDENCE,
} from './ai-vaccine.constants.js';
import { evaluateEligibility } from './engines/eligibility.engine.js';
import { computeBoosterStatuses } from './engines/booster.engine.js';
import { detectMissedVaccines } from './engines/missed-vaccine.engine.js';
import { buildVaccineSafetyReport } from './engines/vaccine-safety-report.engine.js';
import {
  computeVaccineSessionConfidence,
  shouldCreateEscalationRecord,
  shouldRecommendEscalation,
  tierFromScore,
} from './engines/vaccine-confidence.engine.js';
import {
  resolveVaccineEscalationType,
} from './engines/vaccine-escalation.engine.js';
import { classifyVaccineIntent } from './engines/vaccine-intent.engine.js';
import {
  containsAdministrationImperative,
  containsDiagnosisLanguage,
  sanitizeVaccineOutput,
} from './engines/vaccine-output.guard.js';
import { parseAgeWindowDays, resolveEntityType } from './engines/vaccine-metadata.util.js';
import type { ScheduleRow } from './ai-vaccine.types.js';

/** Wave 1 MVC reference values (scripts/bundles/wave1/vaccine.json). */
const WAVE1_SCHEDULE_FIXTURES: Array<{
  slug: string;
  antigen: string;
  ageWindow: string;
  boosterIntervalDays: number;
  minDays: number;
  maxDays: number;
}> = [
  { slug: 'cattle-fmd-schedule', antigen: 'FMD', ageWindow: '৩–৬ মাস', boosterIntervalDays: 180, minDays: 90, maxDays: 180 },
  { slug: 'cattle-hs-bq-schedule', antigen: 'HS/BQ', ageWindow: '৪–৬ মাস', boosterIntervalDays: 365, minDays: 120, maxDays: 180 },
  { slug: 'buffalo-fmd-schedule', antigen: 'FMD', ageWindow: '৬ মাস', boosterIntervalDays: 180, minDays: 165, maxDays: 195 },
];

function scheduleRowFromFixture(f: (typeof WAVE1_SCHEDULE_FIXTURES)[0]): ScheduleRow {
  return {
    slug: f.slug,
    titleBn: f.slug,
    titleEn: f.slug,
    antigen: f.antigen,
    ageWindow: f.ageWindow,
    boosterIntervalDays: f.boosterIntervalDays,
    citations: [
      {
        token: `[cite:${f.slug}]`,
        entityId: `ent-${f.slug}`,
        slug: f.slug,
        sourceKey: 'dls-vaccination-calendar-bd',
        evidenceLevel: 'L2',
      },
    ],
    confidenceScore: 0.75,
  };
}

describe('Vaccine verification — schedule accuracy', () => {
  it('parses Wave 1 age windows to expected day bounds', () => {
    for (const fixture of WAVE1_SCHEDULE_FIXTURES) {
      const bounds = parseAgeWindowDays(fixture.ageWindow);
      expect(bounds.minDays).toBe(fixture.minDays);
      expect(bounds.maxDays).toBe(fixture.maxDays);
    }
  });

  it('preserves Wave 1 booster intervals on schedule rows', () => {
    for (const fixture of WAVE1_SCHEDULE_FIXTURES) {
      const row = scheduleRowFromFixture(fixture);
      expect(row.boosterIntervalDays).toBe(fixture.boosterIntervalDays);
      expect(row.citations[0]?.sourceKey).toBe('dls-vaccination-calendar-bd');
    }
  });

  it('resolves VaccinationSchedule entity type from slug', () => {
    expect(resolveEntityType({}, 'cattle-fmd-schedule')).toBe('VaccinationSchedule');
    expect(resolveEntityType({ entityType: 'Vaccine' }, 'fmd-vaccine')).toBe('Vaccine');
  });
});

describe('Vaccine verification — eligibility rules', () => {
  it('classifies in-window age per Wave 1 FMD schedule', () => {
    const row = scheduleRowFromFixture(WAVE1_SCHEDULE_FIXTURES[0]!);
    const results = evaluateEligibility({ schedules: [row], ageDays: 120 });
    expect(results[0]?.status).toBe('IN_WINDOW');
    expect(results[0]?.vetConfirmRequired).toBe(true);
    expect(results[0]?.citations.length).toBeGreaterThan(0);
  });

  it('requires age for eligibility determination', () => {
    const row = scheduleRowFromFixture(WAVE1_SCHEDULE_FIXTURES[0]!);
    const results = evaluateEligibility({ schedules: [row] });
    expect(results[0]?.status).toBe('UNKNOWN');
  });
});

describe('Vaccine verification — booster calculations', () => {
  it('computes next due from administered date + interval', () => {
    const row = scheduleRowFromFixture(WAVE1_SCHEDULE_FIXTURES[0]!);
    const administered = new Date();
    administered.setUTCDate(administered.getUTCDate() - 100);
    const boosters = computeBoosterStatuses({
      schedules: [row],
      entries: [],
      history: [
        {
          id: 'v1',
          vaccineName: 'FMD vaccine',
          administeredDate: administered,
          scheduledDate: administered,
          nextDueDate: null,
        },
      ],
      vaccineSlugs: [row.slug],
    });
    expect(boosters[0]?.boosterIntervalDays).toBe(180);
    expect(boosters[0]?.nextDueDate).toBeDefined();
    expect(boosters[0]?.dueInDays).toBe(80);
  });

  it('prefers recorded nextDueDate when present', () => {
    const row = scheduleRowFromFixture(WAVE1_SCHEDULE_FIXTURES[0]!);
    const nextDue = new Date();
    nextDue.setUTCDate(nextDue.getUTCDate() + 10);
    const boosters = computeBoosterStatuses({
      schedules: [row],
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
      vaccineSlugs: [row.slug],
    });
    expect(boosters[0]?.nextDueDate).toBe(nextDue.toISOString().slice(0, 10));
    expect(boosters[0]?.dueInDays).toBe(10);
  });
});

describe('Vaccine verification — interaction checks', () => {
  it('routes medicine interaction intent', () => {
    const result = classifyVaccineIntent('FMD টিকার পর antibiotic দেওয়া যাবে?');
    expect(result.intent).toBe('INTERACTION');
  });
});

describe('Vaccine verification — citation grounding', () => {
  it('safety report carries deduplicated citations', () => {
    const row = scheduleRowFromFixture(WAVE1_SCHEDULE_FIXTURES[0]!);
    const report = buildVaccineSafetyReport({
      entries: [],
      eligibility: evaluateEligibility({ schedules: [row], ageDays: 120 }),
      missedAlerts: [],
      boosters: [],
      pregnancy: false,
    });
    expect(report.citations.length).toBeGreaterThan(0);
    expect(report.citations[0]?.token).toContain('[cite:');
  });
});

describe('Vaccine verification — confidence scoring', () => {
  it('uses tier thresholds aligned with Phase 6I plan', () => {
    expect(tierFromScore(0.72)).toBe('STRONG');
    expect(tierFromScore(0.62)).toBe('MODERATE');
    expect(tierFromScore(0.5)).toBe('LIMITED');
    expect(tierFromScore(0.3)).toBe('INSUFFICIENT');
    expect(VACCINE_MIN_CONFIDENCE).toBe(0.6);
    expect(VACCINE_SCHEDULE_MIN_CONFIDENCE).toBe(0.65);
    expect(VACCINE_FAIL_CLOSED_CONFIDENCE).toBe(0.45);
  });

  it('fail-closes when session score below threshold', () => {
    const report = buildVaccineSafetyReport({
      entries: [],
      eligibility: [],
      missedAlerts: [],
      boosters: [],
      pregnancy: false,
      pack: {
        routingDecision: { action: 'BLOCK', reason: 'test' },
      } as never,
    });
    const confidence = computeVaccineSessionConfidence({
      pack: { confidenceSummary: { avg: 0.3, min: 0.3, max: 0.3 }, routingDecision: { action: 'BLOCK' } } as never,
      safetyReport: report,
      hasScheduleFacts: false,
    });
    expect(confidence.failClosed).toBe(true);
    expect(shouldRecommendEscalation(confidence)).toBe(true);
  });
});

describe('Vaccine verification — escalation behavior', () => {
  it('escalates CRITICAL interaction conflicts to VET_CALL_NOW', () => {
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
    const confidence = computeVaccineSessionConfidence({ safetyReport: report, hasScheduleFacts: true });
    expect(resolveVaccineEscalationType({ safetyReport: report, confidence })).toBe('VET_CALL_NOW');
    expect(shouldCreateEscalationRecord({ refused: false, routingBlocked: false, safetyReport: report })).toBe(true);
  });

  it('blocks diagnosis intent from vaccine assistant', () => {
    const result = classifyVaccineIntent('আপনার গরুর রোগ কী?');
    expect(result.blockInVaccine).toBe(true);
    expect(result.redirectAssistant).toBe('ai-doctor');
  });
});

describe('Vaccine verification — output guards', () => {
  it('detects diagnosis language in LLM output', () => {
    expect(containsDiagnosisLanguage('Your animal has mastitis for sure')).toBe(true);
    expect(containsDiagnosisLanguage('FMD schedule is at 3-6 months')).toBe(false);
  });

  it('detects administration imperatives', () => {
    expect(containsAdministrationImperative('Inject 2 ml today')).toBe(true);
    expect(containsAdministrationImperative('Schedule window is 3-6 months')).toBe(false);
  });

  it('sanitizes unsafe LLM output', () => {
    const out = sanitizeVaccineOutput('Inject 2 ml today', 'en');
    expect(out).toContain('veterinarian');
  });
});
