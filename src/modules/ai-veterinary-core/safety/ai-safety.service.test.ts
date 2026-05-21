import { describe, expect, it } from 'vitest';

import { getAiSafetyService } from './ai-safety.service.js';

describe('ai-safety.service', () => {
  const safety = getAiSafetyService();

  it('refuses diagnosis-seeking user input', () => {
    const result = safety.evaluateUserInput('What is the diagnosis?', 'en');
    expect(result?.refused).toBe(true);
    expect(result?.humanRedirect).toBe(true);
    expect(result?.auditAction).toBe('POLICY_REFUSAL_INPUT');
  });

  it('sanitizes unsafe provider output', () => {
    const result = safety.evaluateProviderOutput(
      { content: 'The diagnosis is infection', confidence: 0.9 },
      'en',
    );
    expect(result.refused).toBe(true);
    expect(result.content).toContain('cannot diagnose');
  });

  it('flags low confidence for escalation', () => {
    const result = safety.evaluateProviderOutput(
      { content: 'General care guidance applies.', confidence: 0.4 },
      'en',
    );
    expect(result.escalationRecommended).toBe(true);
    expect(result.auditAction).toBe('LOW_CONFIDENCE');
  });

  it('requires escalation for HIGH triage bucket', () => {
    const triage = safety.evaluateTriage(['not breathing']);
    expect(triage.bucket).toBe('HIGH');
    expect(triage.escalationRequired).toBe(true);
    expect(triage.auditAction).toBe('TRIAGE_ESCALATION');
  });
});
