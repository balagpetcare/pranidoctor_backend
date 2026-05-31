import { describe, expect, it } from 'vitest';

import { analyzeDrugInteractions } from './engines/interaction.engine.js';
import { evaluateContraindications } from './engines/contraindication.engine.js';
import { resolveWithdrawalForDrug } from './engines/withdrawal.engine.js';
import { evaluateVaccineMedicineConflicts } from './engines/vaccine-interaction.engine.js';
import { buildPrescriptionSafetyReport } from './engines/safety-report.engine.js';
import {
  computeSessionConfidence,
  shouldSkipLlmForFarmerDoseRequest,
  tierFromScore,
} from './engines/prescription-confidence.engine.js';
import {
  resolvePrescriptionEscalationType,
} from './engines/prescription-escalation.engine.js';
import { evaluateSpeciesEligibility } from './engines/species-eligibility.engine.js';
import type { PublishedMedicineEntry } from './engines/medicine-metadata.util.js';

function medicineEntry(overrides: Partial<PublishedMedicineEntry> & { slug: string }): PublishedMedicineEntry {
  return {
    id: `id-${overrides.slug}`,
    slug: overrides.slug,
    titleBn: overrides.titleBn ?? overrides.slug,
    titleEn: overrides.titleEn ?? overrides.slug,
    bodyBn: 'body bn',
    bodyEn: 'body en',
    species: overrides.species ?? ['COW'],
    confidenceScore: overrides.confidenceScore ?? 0.85,
    evidenceLevel: overrides.evidenceLevel ?? 'L2',
    metadataJson: overrides.metadataJson ?? { structuredJson: { genericName: overrides.slug } },
    sourceKey: overrides.sourceKey ?? 'test-source',
  };
}

describe('prescription interaction engine', () => {
  it('detects documented drug-drug interaction', () => {
    const a = medicineEntry({
      slug: 'oxytetracycline',
      metadataJson: {
        structuredJson: {
          genericName: 'Oxytetracycline',
          interactsWith: [{ targetSlug: 'penicillin-g', severity: 'CONTRAINDICATED' }],
        },
      },
    });
    const b = medicineEntry({ slug: 'penicillin-g' });
    const bundle = analyzeDrugInteractions([a, b]);
    expect(bundle.pairs).toHaveLength(1);
    expect(bundle.pairs[0]?.severity).toBe('CONTRAINDICATED');
    expect(bundle.overallRisk).toBe('CRITICAL');
  });

  it('flags unresolved pairs when no edge exists', () => {
    const a = medicineEntry({ slug: 'drug-a' });
    const b = medicineEntry({ slug: 'drug-b' });
    const bundle = analyzeDrugInteractions([a, b]);
    expect(bundle.unresolvedPairs).toHaveLength(1);
  });
});

describe('prescription contraindications', () => {
  it('adds pregnancy warning', () => {
    const entry = medicineEntry({
      slug: 'flunixin',
      metadataJson: {
        structuredJson: {
          genericName: 'Flunixin',
          contraindications: ['renal impairment'],
        },
      },
    });
    const warnings = evaluateContraindications({
      entries: [entry],
      species: 'COW',
      pregnancy: true,
      lactating: false,
      locale: 'en',
    });
    expect(warnings.some((w) => w.condition === 'pregnancy')).toBe(true);
    expect(warnings.some((w) => w.condition === 'renal impairment')).toBe(true);
  });
});

describe('prescription withdrawal', () => {
  it('extracts meat and milk withdrawal from matrix', () => {
    const entry = medicineEntry({
      slug: 'ivermectin',
      metadataJson: {
        structuredJson: {
          genericName: 'Ivermectin',
          speciesDoseMatrix: [
            {
              species: 'COW',
              withdrawalMeatDays: 28,
              withdrawalMilkDays: 0,
            },
          ],
        },
      },
    });
    const summary = resolveWithdrawalForDrug(entry, 'COW');
    expect(summary.periods.some((p) => p.productType === 'MEAT' && p.withdrawalDays === 28)).toBe(true);
  });
});

describe('vaccine interaction engine', () => {
  it('flags antibiotic + live vaccine conflict', async () => {
    const med = medicineEntry({
      slug: 'oxytetracycline',
      metadataJson: {
        structuredJson: {
          genericName: 'Oxytetracycline',
          drugClass: 'antibiotic',
        },
      },
    });
    const conflicts = await evaluateVaccineMedicineConflicts({
      medicineEntries: [med],
      vaccineSlugs: ['fmd-vaccine'],
    });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]?.conflictType).toBe('LIVE_VACCINE_ANTIBIOTIC');
  });
});

describe('prescription safety report', () => {
  it('blocks banned substances with regulatory escalation', async () => {
    const entry = medicineEntry({
      slug: 'banned-drug',
      metadataJson: {
        structuredJson: {
          genericName: 'Banned',
          bannedSubstance: true,
        },
      },
    });
    const report = await buildPrescriptionSafetyReport({
      entries: [entry],
      species: 'COW',
      locale: 'en',
      mode: 'FARMER_REFERENCE',
      pregnancy: false,
      lactating: false,
      vaccineSlugs: [],
    });
    expect(report.overallRisk).toBe('CRITICAL');
    expect(report.blockReasons).toContain('BANNED_SUBSTANCE');
    expect(report.escalationType).toBe('REGULATORY_REFERRAL');
    expect(report.citations.length).toBeGreaterThan(0);
  });

  it('flags off-label species', async () => {
    const entry = medicineEntry({
      slug: 'cattle-only',
      species: ['COW'],
      metadataJson: { structuredJson: { genericName: 'CattleOnly' } },
    });
    const report = await buildPrescriptionSafetyReport({
      entries: [entry],
      species: 'GOAT',
      locale: 'en',
      mode: 'FARMER_REFERENCE',
      pregnancy: false,
      lactating: false,
      vaccineSlugs: [],
    });
    expect(report.blockReasons).toContain('OFF_LABEL_SPECIES');
  });
});

describe('prescription confidence', () => {
  it('tiers scores correctly', () => {
    expect(tierFromScore(0.9)).toBe('VERIFIED');
    expect(tierFromScore(0.76)).toBe('MODERATE');
    expect(tierFromScore(0.5)).toBe('INSUFFICIENT');
  });

  it('blocks farmer dose requests', () => {
    expect(
      shouldSkipLlmForFarmerDoseRequest({
        message: 'how much antibiotic dose mg/kg',
        mode: 'FARMER_REFERENCE',
      }),
    ).toBe(true);
    expect(
      shouldSkipLlmForFarmerDoseRequest({
        message: 'what is this medicine',
        mode: 'FARMER_REFERENCE',
      }),
    ).toBe(false);
  });

  it('downgrades confidence for high safety risk', async () => {
    const report = await buildPrescriptionSafetyReport({
      entries: [
        medicineEntry({
          slug: 'bad',
          metadataJson: { structuredJson: { genericName: 'Bad', bannedSubstance: true } },
        }),
      ],
      species: 'COW',
      locale: 'en',
      mode: 'FARMER_REFERENCE',
      pregnancy: false,
      lactating: false,
      vaccineSlugs: [],
    });
    const confidence = computeSessionConfidence({
      pack: {
        confidenceSummary: { min: 0.9, max: 0.9, avg: 0.9 },
        routingDecision: { action: 'PROCEED' },
      } as never,
      safetyReport: report,
    });
    expect(confidence.sessionScore).toBeLessThan(0.9);
    expect(confidence.failClosed).toBe(true);
  });
});

describe('species eligibility', () => {
  it('returns OFF_LABEL for wrong species', () => {
    const entry = medicineEntry({ slug: 'cow-drug', species: ['COW'] });
    expect(evaluateSpeciesEligibility(entry, 'GOAT')).toBe('OFF_LABEL');
  });
});

describe('prescription escalation', () => {
  it('resolves vet call for critical risk', async () => {
    const report = await buildPrescriptionSafetyReport({
      entries: [
        medicineEntry({
          slug: 'banned',
          metadataJson: { structuredJson: { bannedSubstance: true } },
        }),
      ],
      species: 'COW',
      locale: 'en',
      mode: 'FARMER_REFERENCE',
      pregnancy: false,
      lactating: false,
      vaccineSlugs: [],
    });
    const type = resolvePrescriptionEscalationType({
      safetyReport: report,
      confidence: { sessionScore: 0.5, failClosed: true } as never,
    });
    expect(type).toBe('REGULATORY_REFERRAL');
  });
});
