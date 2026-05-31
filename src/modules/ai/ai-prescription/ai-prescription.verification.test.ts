import { describe, expect, it } from 'vitest';

import { validateLlmOutput } from '../knowledge-retrieval/validation/post-llm-validator.service.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval/knowledge-retrieval.types.js';

import {
  PRESCRIPTION_FAIL_CLOSED_CONFIDENCE,
  PRESCRIPTION_ESCALATION_CONFIDENCE,
} from './ai-prescription.constants.js';
import { analyzeDrugInteractions } from './engines/interaction.engine.js';
import { evaluateContraindications } from './engines/contraindication.engine.js';
import { evaluateSpeciesEligibility, evaluateAgeEligibility } from './engines/species-eligibility.engine.js';
import { buildPrescriptionSafetyReport } from './engines/safety-report.engine.js';
import {
  computeSessionConfidence,
  shouldSkipLlmForFarmerDoseRequest,
  shouldCreateEscalationRecord,
  shouldRecommendEscalation,
  tierFromScore,
} from './engines/prescription-confidence.engine.js';
import { containsAutonomousPrescriptionLanguage } from './engines/prescription-output.guard.js';
import { resolvePrescriptionEscalationType } from './engines/prescription-escalation.engine.js';
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

describe('Prescription verification — drug interactions', () => {
  it('blocks contraindicated drug pairs at CRITICAL risk', () => {
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
    expect(bundle.overallRisk).toBe('CRITICAL');
    expect(bundle.pairs[0]?.severity).toBe('CONTRAINDICATED');
  });

  it('surfaces unresolved interaction pairs for vet review', () => {
    const bundle = analyzeDrugInteractions([
      medicineEntry({ slug: 'drug-a' }),
      medicineEntry({ slug: 'drug-b' }),
    ]);
    expect(bundle.unresolvedPairs).toHaveLength(1);
  });
});

describe('Prescription verification — contraindications', () => {
  it('flags pregnancy and structured contraindications', () => {
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

describe('Prescription verification — species & age restrictions', () => {
  it('marks off-label species in safety report', async () => {
    const report = await buildPrescriptionSafetyReport({
      entries: [medicineEntry({ slug: 'cow-only', species: ['COW'] })],
      species: 'GOAT',
      locale: 'en',
      mode: 'FARMER_REFERENCE',
      pregnancy: false,
      lactating: false,
      vaccineSlugs: [],
    });
    expect(report.blockReasons).toContain('OFF_LABEL_SPECIES');
    expect(evaluateSpeciesEligibility(medicineEntry({ slug: 'x', species: ['COW'] }), 'GOAT')).toBe(
      'OFF_LABEL',
    );
  });

  it('blocks when age is outside dose matrix band', async () => {
    const entry = medicineEntry({
      slug: 'calf-drug',
      metadataJson: {
        structuredJson: {
          genericName: 'CalfDrug',
          speciesDoseMatrix: [{ species: 'COW', ageMinDays: 90 }],
        },
      },
    });
    expect(evaluateAgeEligibility(entry, 'COW', 30).eligible).toBe(false);
    const report = await buildPrescriptionSafetyReport({
      entries: [entry],
      species: 'COW',
      locale: 'en',
      mode: 'FARMER_REFERENCE',
      pregnancy: false,
      lactating: false,
      vaccineSlugs: [],
      ageDays: 30,
    });
    expect(report.blockReasons).toContain('AGE_RESTRICTION');
  });
});

describe('Prescription verification — safety warnings & banned substances', () => {
  it('escalates banned substances to regulatory referral', async () => {
    const report = await buildPrescriptionSafetyReport({
      entries: [
        medicineEntry({
          slug: 'banned',
          metadataJson: { structuredJson: { genericName: 'Banned', bannedSubstance: true } },
        }),
      ],
      species: 'COW',
      locale: 'en',
      mode: 'FARMER_REFERENCE',
      pregnancy: false,
      lactating: false,
      vaccineSlugs: [],
    });
    expect(report.overallRisk).toBe('CRITICAL');
    expect(report.escalationType).toBe('REGULATORY_REFERRAL');
    expect(report.citations.length).toBeGreaterThan(0);
  });
});

describe('Prescription verification — citation grounding', () => {
  it('includes medicine citations on safety report entries', async () => {
    const report = await buildPrescriptionSafetyReport({
      entries: [medicineEntry({ slug: 'ivermectin' })],
      species: 'COW',
      locale: 'en',
      mode: 'FARMER_REFERENCE',
      pregnancy: false,
      lactating: false,
      vaccineSlugs: [],
    });
    expect(report.citations.some((c) => c.token.includes('ivermectin'))).toBe(true);
  });
});

describe('Prescription verification — confidence scoring', () => {
  it('fail-closes below prescription confidence floor', async () => {
    const report = await buildPrescriptionSafetyReport({
      entries: [
        medicineEntry({
          slug: 'bad',
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
    const confidence = computeSessionConfidence({
      pack: {
        confidenceSummary: { min: 0.9, max: 0.9, avg: 0.9 },
        routingDecision: { action: 'PROCEED' },
      } as never,
      safetyReport: report,
    });
    expect(confidence.sessionScore).toBeLessThan(PRESCRIPTION_FAIL_CLOSED_CONFIDENCE);
    expect(confidence.failClosed).toBe(true);
    expect(tierFromScore(confidence.sessionScore)).toBe('INSUFFICIENT');
  });

  it('recommends escalation below escalation threshold', () => {
    const confidence = computeSessionConfidence({
      pack: {
        confidenceSummary: { min: 0.7, max: 0.7, avg: 0.7 },
        routingDecision: { action: 'PROCEED_DEGRADED' },
      } as never,
      safetyReport: {
        overallRisk: 'LOW',
        blockReasons: [],
        escalationRequired: false,
      } as never,
    });
    expect(confidence.sessionScore).toBeLessThan(PRESCRIPTION_ESCALATION_CONFIDENCE);
    expect(shouldRecommendEscalation(confidence)).toBe(true);
  });
});

describe('Prescription verification — farmer dose prohibition (PX-03)', () => {
  it('skips LLM for farmer dose, prescribe, and BN injection queries', () => {
    for (const message of [
      'how much mg/kg dose',
      'prescribe antibiotic for cow',
      'ইঞ্জেকশন কত দিব',
    ]) {
      expect(
        shouldSkipLlmForFarmerDoseRequest({ message, mode: 'FARMER_REFERENCE' }),
      ).toBe(true);
    }
    expect(
      shouldSkipLlmForFarmerDoseRequest({
        message: 'what is oxytetracycline used for',
        mode: 'FARMER_REFERENCE',
      }),
    ).toBe(false);
  });
});

describe('Prescription verification — hallucination & PX-01 guard', () => {
  const pack = {
    packId: 'p1',
    query: 'medicine info',
    locale: 'en',
    routingDecision: { action: 'PROCEED', reason: 'ok' },
    structuredFacts: [],
    chunks: [],
  } as unknown as KnowledgeContextPack;

  it('blocks uncited dosage in prescription LLM output', () => {
    const result = validateLlmOutput({
      llmOutput: 'Administer 5 mg/kg daily for 5 days.',
      pack,
      taskType: 'PRESCRIPTION_ANALYSIS',
    });
    expect(result.action).toBe('BLOCK');
  });

  it('blocks autonomous prescription language (PX-01)', () => {
    expect(containsAutonomousPrescriptionLanguage('Give 10 ml inject daily')).toBe(true);
    expect(containsAutonomousPrescriptionLanguage('This medicine treats bacterial infection')).toBe(
      false,
    );
    const result = validateLlmOutput({
      llmOutput: 'Inject 2 ml IM every 12 hours.',
      pack: { ...pack, structuredFacts: [{ factType: 'DOSE_ML_KG', value: 2, unit: 'ml/kg' }] },
      taskType: 'PRESCRIPTION_ANALYSIS',
    });
    expect(result.action).toBe('BLOCK');
    expect(result.failures.some((f) => f.code === 'autonomous_prescription')).toBe(true);
  });
});

describe('Prescription verification — escalation behavior', () => {
  it('creates escalation record only on clinical triggers', () => {
    const cleanReport = {
      overallRisk: 'LOW',
      blockReasons: [],
      escalationRequired: false,
    } as never;
    expect(
      shouldCreateEscalationRecord({
        refused: false,
        routingBlocked: false,
        safetyReport: cleanReport,
      }),
    ).toBe(false);

    expect(
      shouldCreateEscalationRecord({
        refused: true,
        routingBlocked: false,
        safetyReport: cleanReport,
      }),
    ).toBe(true);
  });

  it('maps critical safety to regulatory or vet escalation types', async () => {
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
    expect(
      resolvePrescriptionEscalationType({
        safetyReport: report,
        confidence: { sessionScore: 0.5, failClosed: true } as never,
      }),
    ).toBe('REGULATORY_REFERRAL');
  });
});
