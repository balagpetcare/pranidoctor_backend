import { describe, expect, it, vi, beforeEach } from 'vitest';

import { validateLegalSafeMessaging } from '../../shared/compliance/messaging-compliance.js';
import {
  assessSymptomRisk,
  shouldRefuseUserInput,
} from '../ai-veterinary-core/safety/ai-safety.guardrails.js';

import { AiGovernanceService } from '../ai/governance/ai-governance.service.js';

/** Recommended escalation copy patterns (educational, not dispatch). */
const SAFE_ESCALATION_PHRASES = [
  'Seek a licensed veterinarian as soon as possible.',
  'This is not a substitute for emergency veterinary care.',
  'We cannot dispatch a veterinarian to your location.',
];

const UNSAFE_ESCALATION_PHRASES = [
  'A vet dispatched to your farm.',
  'Typical response: 10 minutes',
  'Guaranteed recovery within 24 hours',
];

describe('AI emergency escalation validation', () => {
  it('E2E-EM-AI-01: detects emergency indicators in symptoms', () => {
    const risk = assessSymptomRisk(['unable to stand', 'severe bleeding']);
    expect(risk.emergency).toBe(true);
    expect(risk.bucket).toBe('HIGH');
  });

  it('refuses prescription requests during emergency triage', () => {
    expect(shouldRefuseUserInput('Please prescribe antibiotics now')).toBe(true);
  });

  it('allows descriptive emergency symptoms', () => {
    expect(shouldRefuseUserInput('My cow collapsed and is not breathing well')).toBe(false);
  });

  it.each(SAFE_ESCALATION_PHRASES)('compliance: safe escalation copy — %s', (phrase) => {
    expect(validateLegalSafeMessaging(phrase).ok).toBe(true);
  });

  it.each(UNSAFE_ESCALATION_PHRASES)('compliance: rejects unsafe escalation copy — %s', (phrase) => {
    expect(validateLegalSafeMessaging(phrase).ok).toBe(false);
  });

  it('E-05: governance service exposes LLM disable check', () => {
    const gov = new AiGovernanceService();
    expect(typeof gov.isLlmDisabled).toBe('function');
  });
});

describe('AI emergency — professional care recommendation', () => {
  it('HIGH risk emergency symptoms require professional care path', () => {
    const risk = assessSymptomRisk(['not breathing']);
    expect(risk.emergency).toBe(true);
    expect(risk.bucket).toBe('HIGH');
    expect(risk.urgencyLevel).toBeGreaterThanOrEqual(10);
  });
});
