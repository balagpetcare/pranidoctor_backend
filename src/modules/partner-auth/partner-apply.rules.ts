import { canProvideService, type PartnerRole } from './partner-roles.js';

export type ProviderStatusLike = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export type ExistingPartnerProfile = {
  role: PartnerRole;
  providerStatus: ProviderStatusLike;
  /** Admin asked for changes (AI technician: NEEDS_CORRECTION). */
  needsCorrection: boolean;
};

export type ApplyDecision =
  | { ok: true; mode: 'create' | 'resubmit' }
  | { ok: false; code: ApplyBlockCode; message: string };

export type ApplyBlockCode =
  | 'COVERED_BY_EXISTING_ROLE'
  | 'ALREADY_ACTIVE'
  | 'UNDER_REVIEW'
  | 'ACCOUNT_SUSPENDED';

export const APPLY_MSG: Record<ApplyBlockCode, string> = {
  COVERED_BY_EXISTING_ROLE:
    'আপনার বর্তমান ভূমিকায় এই সেবা আগে থেকেই অন্তর্ভুক্ত, আলাদা আবেদন লাগবে না।',
  ALREADY_ACTIVE: 'এই ভূমিকায় আপনি আগেই অনুমোদিত।',
  UNDER_REVIEW: 'আপনার আবেদন যাচাই চলছে। ফলাফল না আসা পর্যন্ত অপেক্ষা করুন।',
  ACCOUNT_SUSPENDED: 'আপনার অ্যাকাউন্ট স্থগিত। সহায়তা কেন্দ্রের সাথে যোগাযোগ করুন।',
};

function block(code: ApplyBlockCode): ApplyDecision {
  return { ok: false, code, message: APPLY_MSG[code] };
}

/**
 * Decides whether the signed-in user may submit an application for `requested`.
 *  - A broader role already held (or being reviewed) covers narrower ones — no extra application.
 *  - Applying for a broader role while holding a narrower one is allowed (needs its own credentials).
 *  - Re-submitting is allowed only after rejection or when changes were requested.
 */
export function decideApply(existing: ExistingPartnerProfile[], requested: PartnerRole): ApplyDecision {
  const same = existing.find((p) => p.role === requested);
  if (same) {
    if (same.providerStatus === 'ACTIVE') return block('ALREADY_ACTIVE');
    if (same.providerStatus === 'SUSPENDED') return block('ACCOUNT_SUSPENDED');
    if (same.providerStatus === 'PENDING_VERIFICATION' && !same.needsCorrection) {
      return block('UNDER_REVIEW');
    }
    return { ok: true, mode: 'resubmit' };
  }

  const covering = existing.find(
    (p) => p.providerStatus !== 'REJECTED' && p.role !== requested && canProvideService(p.role, requested),
  );
  if (covering) return block('COVERED_BY_EXISTING_ROLE');

  return { ok: true, mode: 'create' };
}
