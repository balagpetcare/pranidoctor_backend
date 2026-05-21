import { describe, expect, it } from 'vitest';

import { resolveConflict, defaultConflictStrategy } from './conflict-resolver.js';

describe('conflict-resolver', () => {
  it('uses SERVER_WINS for auth snapshot', () => {
    expect(defaultConflictStrategy('AUTH_SNAPSHOT')).toBe('SERVER_WINS');
  });

  it('detects profile merge conflict', () => {
    const result = resolveConflict({
      entityType: 'PROFILE',
      clientVersion: 'v1',
      serverVersion: 'v2',
    });
    expect(result.conflict).toBe(true);
    expect(result.resolution).toBe('MERGE_REQUIRED');
  });

  it('allows local wins for case draft version mismatch', () => {
    const result = resolveConflict({
      entityType: 'CASE_DRAFT',
      clientVersion: 'v1',
      serverVersion: 'v2',
    });
    expect(result.conflict).toBe(false);
    expect(result.resolution).toBe('LOCAL_WINS');
  });
});
