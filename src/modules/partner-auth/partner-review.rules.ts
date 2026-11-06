import type { PartnerRole } from './partner-roles.js';

export type ReviewAction = 'approve' | 'reject' | 'request_changes' | 'suspend' | 'reactivate';
export type ReviewProviderStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export type ReviewBucket = 'PENDING' | 'CORRECTION' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export const REVIEW_BUCKETS: readonly ReviewBucket[] = [
  'PENDING',
  'CORRECTION',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED',
];

export function bucketOf(status: ReviewProviderStatus, needsCorrection: boolean): ReviewBucket {
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'SUSPENDED') return 'SUSPENDED';
  return needsCorrection ? 'CORRECTION' : 'PENDING';
}

/** Actions that must carry an explanation the partner will read. */
export function noteRequired(action: ReviewAction): boolean {
  return action === 'reject' || action === 'request_changes';
}

export type ReviewTransition =
  | { ok: true; status: ReviewProviderStatus; needsCorrection: boolean }
  | { ok: false; message: string };

/** Which action is allowed from which state (pure; the service applies it). */
export function transitionFor(
  from: ReviewProviderStatus,
  action: ReviewAction,
): ReviewTransition {
  const bad = (message: string): ReviewTransition => ({ ok: false, message });
  switch (action) {
    case 'approve':
      if (from === 'ACTIVE') return bad('আগেই অনুমোদিত।');
      if (from === 'SUSPENDED') return bad('স্থগিত অ্যাকাউন্ট আগে সক্রিয় করুন।');
      return { ok: true, status: 'ACTIVE', needsCorrection: false };
    case 'reject':
      if (from === 'ACTIVE' || from === 'SUSPENDED') return bad('অনুমোদিত বা স্থগিত আবেদন বাতিল করা যায় না।');
      return { ok: true, status: 'REJECTED', needsCorrection: false };
    case 'request_changes':
      if (from !== 'PENDING_VERIFICATION') return bad('শুধু অপেক্ষমান আবেদনে সংশোধন চাওয়া যায়।');
      return { ok: true, status: 'PENDING_VERIFICATION', needsCorrection: true };
    case 'suspend':
      if (from !== 'ACTIVE') return bad('শুধু সক্রিয় সেবাদাতাকে স্থগিত করা যায়।');
      return { ok: true, status: 'SUSPENDED', needsCorrection: false };
    case 'reactivate':
      if (from !== 'SUSPENDED') return bad('শুধু স্থগিত সেবাদাতাকে সক্রিয় করা যায়।');
      return { ok: true, status: 'ACTIVE', needsCorrection: false };
  }
}

/** User.role to promote to on approval (health workers stay CUSTOMER accounts). */
export function promotedUserRole(role: PartnerRole): 'DOCTOR' | 'AI_TECHNICIAN' | null {
  if (role === 'DOCTOR') return 'DOCTOR';
  if (role === 'AI_TECHNICIAN') return 'AI_TECHNICIAN';
  return null;
}
