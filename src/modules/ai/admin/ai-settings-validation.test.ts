import { describe, expect, it } from 'vitest';

import { validateSettingsPayload, isKnownSettingsKey } from './ai-admin.schemas.js';

describe('settings validation', () => {
  it('accepts known routing settings', () => {
    const parsed = validateSettingsPayload('routing.default', {
      honorDbRoutes: true,
      preferredProvider: 'openai',
    });
    expect(parsed.honorDbRoutes).toBe(true);
  });

  it('rejects invalid budget values', () => {
    expect(() =>
      validateSettingsPayload('budget.global', { dailyBudgetUsd: -1 }),
    ).toThrow();
  });

  it('rejects unknown settings keys', () => {
    expect(isKnownSettingsKey('unknown.key')).toBe(false);
    expect(() => validateSettingsPayload('unknown.key', {})).toThrow(/Unknown settings key/);
  });
});
