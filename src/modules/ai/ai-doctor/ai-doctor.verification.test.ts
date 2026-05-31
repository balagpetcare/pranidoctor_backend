import { describe, expect, it } from 'vitest';

import { containsDiagnosisLanguage } from '../../ai-veterinary-core/safety/ai-safety.guardrails.js';
import { validateLlmOutput } from '../knowledge-retrieval/validation/post-llm-validator.service.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval/knowledge-retrieval.types.js';

import {
  AI_DOCTOR_FAIL_CLOSED_CONFIDENCE,
  AI_DOCTOR_COMPLETENESS_LLM_THRESHOLD,
} from './ai-doctor.constants.js';
import {
  computeCaseConfidence,
  shouldFailClosed,
  shouldRecommendEscalation,
} from './engines/confidence.engine.js';
import {
  allDifferentialsHaveCitations,
  formatDifferentialSummary,
  isTreatmentIntentQuery,
} from './engines/differential-diagnosis.engine.js';
import {
  detectLexiconEmergency,
  shouldSkipLlmForEmergency,
} from './engines/emergency-detection.engine.js';
import {
  assertIntakeHasSymptoms,
  computeSymptomCompleteness,
  meetsLlmCompletenessGate,
} from './engines/symptom-intake.engine.js';
import { resolveEscalationReason, resolveEscalationType } from './engines/vet-escalation.engine.js';

describe('AI Doctor verification — symptom collection', () => {
  it('requires at least one symptom signal', () => {
    expect(() =>
      assertIntakeHasSymptoms({ symptomCodes: [], freeTextSymptoms: [], normalizedTerms: [] }),
    ).toThrow();
    expect(() =>
      assertIntakeHasSymptoms({ symptomCodes: ['FEVER'], freeTextSymptoms: [], normalizedTerms: [] }),
    ).not.toThrow();
  });

  it('gates LLM until completeness >= threshold', () => {
    const low = computeSymptomCompleteness({ symptomCodes: ['FEVER'], freeTextSymptoms: [] });
    expect(low.score).toBeLessThan(AI_DOCTOR_COMPLETENESS_LLM_THRESHOLD);
    expect(meetsLlmCompletenessGate(low)).toBe(false);

    const ok = computeSymptomCompleteness({
      symptomCodes: ['FEVER'],
      freeTextSymptoms: ['cow hot'],
      durationDays: 2,
      severity: 'MODERATE',
    });
    expect(meetsLlmCompletenessGate(ok)).toBe(true);
  });
});

describe('AI Doctor verification — emergency detection', () => {
  it('detects BN emergency lexicon and skips LLM', () => {
    const emergency = detectLexiconEmergency(
      {
        symptomCodes: [],
        freeTextSymptoms: ['গরু মরে যাচ্ছে জরুরি'],
        normalizedTerms: [],
      },
      'bn',
    );
    expect(emergency).toBe(true);
    expect(
      shouldSkipLlmForEmergency({
        urgencyTier: 'CRITICAL',
        triageBucket: 'HIGH',
        urgencyLevel: 10,
        redFlags: [],
        recommendationBn: '',
        recommendationEn: '',
        escalationRequired: true,
        emergency: true,
      }),
    ).toBe(true);
  });

  it('maps emergency to VET_CALL_NOW escalation', () => {
    expect(
      resolveEscalationType({
        urgencyTier: 'CRITICAL',
        routingAction: 'BLOCK',
        caseConfidence: 0,
        emergency: true,
      }),
    ).toBe('VET_CALL_NOW');
  });
});

describe('AI Doctor verification — diagnosis reasoning & grounding', () => {
  it('formats differentials as educational with citations', () => {
    const summary = formatDifferentialSummary(
      [
        {
          slug: 'mastitis',
          titleBn: 'Mastitis',
          titleEn: 'Mastitis',
          rank: 1,
          confidenceScore: 0.8,
          evidenceLevel: 'L2',
          supportingSymptoms: ['FEVER'],
          citations: ['[dls-mastitis]'],
          source: 'fused',
        },
      ],
      'en',
    );
    expect(summary).toContain('Possible causes');
    expect(summary).toContain('[dls-mastitis]');
    expect(summary).not.toMatch(/confirmed diagnosis/i);
  });

  it('blocks treatment-intent queries at analyze gate', () => {
    expect(isTreatmentIntentQuery('cow antibiotic dose mastitis')).toBe(true);
    expect(isTreatmentIntentQuery('cow fever symptoms')).toBe(false);
  });
});

describe('AI Doctor verification — low confidence & fail-closed', () => {
  it('fail-closes below confidence floor', () => {
    const confidence = computeCaseConfidence({
      differentials: [],
      completeness: computeSymptomCompleteness({ symptomCodes: [], freeTextSymptoms: ['x'] }),
    });
    expect(confidence.caseScore).toBeLessThan(AI_DOCTOR_FAIL_CLOSED_CONFIDENCE);
    expect(
      shouldFailClosed({
        confidence,
        routingAction: 'PROCEED',
        hasGroundedCitations: false,
      }),
    ).toBe(true);
  });

  it('fail-closes PROCEED_DEGRADED when case score below escalation threshold', () => {
    const confidence = computeCaseConfidence({
      differentials: [
        {
          slug: 'x',
          titleBn: 'X',
          titleEn: 'X',
          rank: 1,
          confidenceScore: 0.45,
          evidenceLevel: 'L2',
          supportingSymptoms: [],
          citations: ['[x]'],
          source: 'graph',
        },
      ],
      completeness: computeSymptomCompleteness({
        symptomCodes: ['FEVER'],
        freeTextSymptoms: [],
        durationDays: 1,
      }),
    });
    expect(
      shouldFailClosed({
        confidence,
        routingAction: 'PROCEED_DEGRADED',
        hasGroundedCitations: true,
      }),
    ).toBe(true);
  });

  it('recommends escalation when confidence below threshold', () => {
    const confidence = computeCaseConfidence({
      differentials: [],
      completeness: computeSymptomCompleteness({ symptomCodes: ['FEVER'], freeTextSymptoms: [] }),
    });
    expect(shouldRecommendEscalation(confidence)).toBe(true);
  });
});

describe('AI Doctor verification — hallucination resistance', () => {
  const pack = {
    packId: 'p1',
    query: 'antibiotic dose',
    locale: 'en',
    routingDecision: { action: 'PROCEED', reason: 'ok' },
    structuredFacts: [],
    chunks: [],
  } as unknown as KnowledgeContextPack;

  it('blocks uncited dosage in LLM output', () => {
    const result = validateLlmOutput({
      llmOutput: 'Give 10 mg/kg enrofloxacin daily.',
      pack,
      taskType: 'DISEASE_ANALYSIS',
    });
    expect(result.action).toBe('BLOCK');
  });

  it('flags definitive diagnosis language', () => {
    expect(containsDiagnosisLanguage('Your cow definitely has mastitis')).toBe(true);
    expect(containsDiagnosisLanguage('Possible causes include mastitis')).toBe(false);
  });
});

describe('AI Doctor verification — vet escalation', () => {
  it('creates LOW_CONFIDENCE escalation reason', () => {
    expect(
      resolveEscalationReason({
        urgencyTier: 'LOW',
        routingAction: 'PROCEED_DEGRADED',
        caseConfidence: 0.4,
        emergency: false,
      }),
    ).toBe('LOW_CONFIDENCE');
  });

  it('requires citations on all differentials before proceed', () => {
    expect(
      allDifferentialsHaveCitations([
        {
          slug: 'a',
          titleBn: 'A',
          titleEn: 'A',
          rank: 1,
          confidenceScore: 0.9,
          evidenceLevel: 'L2',
          supportingSymptoms: [],
          citations: ['[a]'],
          source: 'graph',
        },
      ]),
    ).toBe(true);
  });
});
