import { describe, expect, it } from 'vitest';

import { AI_MEMORY_TTL_DAYS } from './ai-veterinary-core.types.js';

describe('ai-veterinary-core types', () => {
  it('defines memory TTL per kind', () => {
    expect(AI_MEMORY_TTL_DAYS.CONVERSATION).toBe(30);
    expect(AI_MEMORY_TTL_DAYS.CASE_CONTEXT).toBe(7);
    expect(AI_MEMORY_TTL_DAYS.PREFERENCE).toBe(90);
  });
});

describe('ai audit policy', () => {
  it('excludes diagnosis memory kind from allowed enum surface', () => {
    const allowed = ['CONVERSATION', 'CASE_CONTEXT', 'PREFERENCE'];
    expect(allowed).not.toContain('DIAGNOSIS');
  });
});
