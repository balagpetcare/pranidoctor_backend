import { describe, expect, it } from 'vitest';

import { resolveTaskTypeForFeature } from './feature-task-map.js';
import { scopeKeysForHierarchy } from './ai-scope.util.js';

describe('feature-task-map', () => {
  it('maps farmer chat features to GENERAL_CHAT', () => {
    expect(resolveTaskTypeForFeature('CHAT')).toBe('GENERAL_CHAT');
    expect(resolveTaskTypeForFeature('FARM_BRIEFING')).toBe('GENERAL_CHAT');
  });

  it('maps symptom features to DISEASE_ANALYSIS', () => {
    expect(resolveTaskTypeForFeature('symptom_checker')).toBe('DISEASE_ANALYSIS');
    expect(resolveTaskTypeForFeature('ai_doctor')).toBe('DISEASE_ANALYSIS');
    expect(resolveTaskTypeForFeature('prescription_assistant')).toBe('PRESCRIPTION_ANALYSIS');
  });
});

describe('ai-scope.util', () => {
  it('builds scope hierarchy keys', () => {
    const keys = scopeKeysForHierarchy('tenant:t1:branch:b1', 't1', 'b1');
    expect(keys).toContain('platform');
    expect(keys[0]).toBe('tenant:t1:branch:b1');
  });
});
