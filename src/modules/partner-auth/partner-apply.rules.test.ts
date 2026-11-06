import { describe, expect, it } from 'vitest';

import { decideApply, type ExistingPartnerProfile } from './partner-apply.rules.js';

const p = (
  role: ExistingPartnerProfile['role'],
  providerStatus: ExistingPartnerProfile['providerStatus'],
  needsCorrection = false,
): ExistingPartnerProfile => ({ role, providerStatus, needsCorrection });

describe('decideApply', () => {
  it('lets a plain user apply for any role', () => {
    expect(decideApply([], 'DOCTOR')).toEqual({ ok: true, mode: 'create' });
    expect(decideApply([], 'HEALTH_WORKER')).toEqual({ ok: true, mode: 'create' });
  });

  it('blocks narrower roles already covered by an approved or pending broader role', () => {
    expect(decideApply([p('DOCTOR', 'ACTIVE')], 'AI_TECHNICIAN').ok).toBe(false);
    expect(decideApply([p('AI_TECHNICIAN', 'PENDING_VERIFICATION')], 'HEALTH_WORKER').ok).toBe(false);
  });

  it('allows a narrower role holder to apply for a broader role', () => {
    expect(decideApply([p('HEALTH_WORKER', 'ACTIVE')], 'DOCTOR')).toEqual({ ok: true, mode: 'create' });
  });

  it('does not treat a rejected broader role as coverage', () => {
    expect(decideApply([p('DOCTOR', 'REJECTED')], 'HEALTH_WORKER')).toEqual({ ok: true, mode: 'create' });
  });

  it('allows re-submission after rejection or when changes are requested only', () => {
    expect(decideApply([p('DOCTOR', 'REJECTED')], 'DOCTOR')).toEqual({ ok: true, mode: 'resubmit' });
    expect(decideApply([p('AI_TECHNICIAN', 'PENDING_VERIFICATION', true)], 'AI_TECHNICIAN')).toEqual({
      ok: true,
      mode: 'resubmit',
    });
    expect(decideApply([p('DOCTOR', 'PENDING_VERIFICATION')], 'DOCTOR').ok).toBe(false);
    expect(decideApply([p('DOCTOR', 'ACTIVE')], 'DOCTOR').ok).toBe(false);
    expect(decideApply([p('DOCTOR', 'SUSPENDED')], 'DOCTOR').ok).toBe(false);
  });
});
