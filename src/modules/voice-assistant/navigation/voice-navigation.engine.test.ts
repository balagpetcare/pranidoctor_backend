import { describe, expect, it } from 'vitest';

import { resolveNavigationCommand } from './voice-navigation.engine.js';

describe('voice-navigation.engine', () => {
  it('resolves Bangla back command', () => {
    const result = resolveNavigationCommand('পিছনে যান', 'bn');
    expect(result.action).toBe('BACK');
    expect(result.success).toBe(true);
  });

  it('resolves Banglish help alias', () => {
    const result = resolveNavigationCommand('help please', 'en');
    expect(result.action).toBe('HELP');
  });

  it('returns UNKNOWN for unrecognized utterance', () => {
    const result = resolveNavigationCommand('random noise', 'bn');
    expect(result.action).toBe('UNKNOWN');
    expect(result.success).toBe(false);
  });
});
