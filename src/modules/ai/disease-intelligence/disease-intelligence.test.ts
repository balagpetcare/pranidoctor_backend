import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClinicalSafetyEngine } from './safety/clinical-safety.engine.js';
import * as repoModule from './disease-intelligence.repository.js';
import * as analyticsModule from './analytics/disease-analytics.service.js';

const policy = {
  id: 'p1',
  version: 'die-v1',
  rulesJson: {
    blockAutonomousDiagnosis: true,
    blockAutonomousPrescription: true,
    blockAutonomousTreatmentPlan: true,
    treatmentIntentBlock: true,
    prescriptionIntentBlock: true,
    requireCitationsForDifferentials: true,
    zoonoticWarn: true,
    notifiablePrompt: true,
  },
  effectiveFrom: new Date(),
  approvedByVetId: null,
  createdAt: new Date(),
};

describe('ClinicalSafetyEngine', () => {
  beforeEach(() => {
    vi.spyOn(repoModule, 'getDiseaseIntelligenceRepository').mockReturnValue({
      getActiveSafetyPolicy: vi.fn().mockResolvedValue(policy),
      logSafetyEvaluation: vi.fn().mockResolvedValue({ id: 'log1' }),
    } as never);
    vi.spyOn(analyticsModule, 'getDiseaseAnalyticsService').mockReturnValue({
      track: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  it('blocks treatment intent queries', async () => {
    const engine = new ClinicalSafetyEngine();
    const decision = await engine.evaluate({
      queryText: 'What antibiotic dose should I give my cow?',
      locale: 'en',
    });
    expect(decision.action).toBe('BLOCK');
    expect(decision.blockLlm).toBe(true);
    expect(decision.reasonCodes).toContain('TREATMENT_INTENT');
  });

  it('blocks autonomous diagnosis language in post-LLM output', async () => {
    const engine = new ClinicalSafetyEngine();
    const decision = await engine.evaluate({
      queryText: 'fever and cough',
      locale: 'en',
      postLlm: true,
      llmOutput: 'Your cow definitely has mastitis.',
    });
    expect(decision.action).toBe('BLOCK');
    expect(decision.reasonCodes).toContain('AUTONOMOUS_DIAGNOSIS_LANGUAGE');
  });
});
