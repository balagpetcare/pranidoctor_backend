import { describe, expect, it } from 'vitest';

import { bucketOf, noteRequired, promotedUserRole, transitionFor } from './partner-review.rules.js';

describe('partner review rules', () => {
  it('buckets statuses', () => {
    expect(bucketOf('PENDING_VERIFICATION', false)).toBe('PENDING');
    expect(bucketOf('PENDING_VERIFICATION', true)).toBe('CORRECTION');
    expect(bucketOf('ACTIVE', true)).toBe('ACTIVE');
  });
  it('allows only valid transitions', () => {
    expect(transitionFor('PENDING_VERIFICATION', 'approve')).toEqual({ ok: true, status: 'ACTIVE', needsCorrection: false });
    expect(transitionFor('PENDING_VERIFICATION', 'request_changes')).toEqual({
      ok: true,
      status: 'PENDING_VERIFICATION',
      needsCorrection: true,
    });
    expect(transitionFor('ACTIVE', 'approve').ok).toBe(false);
    expect(transitionFor('ACTIVE', 'reject').ok).toBe(false);
    expect(transitionFor('ACTIVE', 'suspend').ok).toBe(true);
    expect(transitionFor('SUSPENDED', 'reactivate').ok).toBe(true);
    expect(transitionFor('REJECTED', 'approve').ok).toBe(true);
  });
  it('requires notes for reject/request_changes and promotes doctor/AI only', () => {
    expect(noteRequired('reject')).toBe(true);
    expect(noteRequired('approve')).toBe(false);
    expect(promotedUserRole('HEALTH_WORKER')).toBeNull();
    expect(promotedUserRole('DOCTOR')).toBe('DOCTOR');
  });
});
