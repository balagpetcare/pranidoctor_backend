import { describe, expect, it } from 'vitest';

import {
  assessSymptomRisk,
  containsDiagnosisLanguage,
  shouldRefuseUserInput,
} from './ai-safety.guardrails.js';

describe('ai-safety.guardrails', () => {
  it('detects diagnosis language in user input', () => {
    expect(containsDiagnosisLanguage('The diagnosis is mastitis')).toBe(true);
    expect(shouldRefuseUserInput('Please prescribe amoxicillin')).toBe(true);
  });

  it('allows educational symptom descriptions', () => {
    expect(shouldRefuseUserInput('My cow has reduced appetite')).toBe(false);
  });

  it('escalates emergency symptoms to HIGH', () => {
    const risk = assessSymptomRisk(['not breathing', 'collapse']);
    expect(risk.bucket).toBe('HIGH');
    expect(risk.emergency).toBe(true);
  });

  it('maps mild symptoms to LOW', () => {
    const risk = assessSymptomRisk(['mild cough']);
    expect(risk.bucket).toBe('LOW');
  });
});
