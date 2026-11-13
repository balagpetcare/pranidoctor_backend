/**
 * Free Zone comment rules (pure).
 *
 * Owner-approved (2026-11-13): public thread on a free question; verified doctors and other customers may comment;
 * the asker can hide/unhide comments on their own question; any other user can report; N open reports auto-hide
 * the comment until an admin reviews it.
 */

export const COMMENT_MAX = 1000;

export type CommentStatus = 'VISIBLE' | 'HIDDEN_BY_OWNER' | 'AUTO_HIDDEN' | 'HIDDEN_BY_ADMIN';

/** Returns a Bengali error message, or null when the body is acceptable. */
export function checkCommentBody(body: string): string | null {
  const t = body.trim();
  if (t.length === 0) return 'মন্তব্য খালি রাখা যাবে না।';
  if (t.length > COMMENT_MAX) return `মন্তব্য সর্বোচ্চ ${COMMENT_MAX} অক্ষরের হতে পারবে।`;
  return null;
}

/**
 * Who sees a comment:
 *  - VISIBLE: everyone
 *  - HIDDEN_BY_OWNER: its author and the asker (so the asker can unhide)
 *  - AUTO_HIDDEN / HIDDEN_BY_ADMIN: its author only (admin panel reads them separately)
 */
export function viewerCanSeeComment(c: { status: CommentStatus; isAuthor: boolean; isQuestionOwner: boolean }): boolean {
  if (c.status === 'VISIBLE') return true;
  if (c.isAuthor) return true;
  return c.status === 'HIDDEN_BY_OWNER' && c.isQuestionOwner;
}

/** Asker hides/unhides. Only HIDDEN_BY_OWNER <-> VISIBLE is the asker's to flip; admin/auto hides stay. */
export function ownerToggle(status: CommentStatus, hide: boolean): CommentStatus | null {
  if (hide) return status === 'VISIBLE' ? 'HIDDEN_BY_OWNER' : status === 'HIDDEN_BY_OWNER' ? 'HIDDEN_BY_OWNER' : null;
  return status === 'HIDDEN_BY_OWNER' ? 'VISIBLE' : status === 'VISIBLE' ? 'VISIBLE' : null;
}

/** Status after a new report is recorded; `openReports` already includes the new one. */
export function statusAfterReport(status: CommentStatus, openReports: number, threshold: number): CommentStatus {
  if (status !== 'VISIBLE' && status !== 'HIDDEN_BY_OWNER') return status;
  return status === 'VISIBLE' && openReports >= threshold ? 'AUTO_HIDDEN' : status;
}

export type AdminCommentAction = 'DISMISS' | 'HIDE';

/** Admin review of a reported comment: DISMISS restores auto-hidden, HIDE hides it for good. */
export function statusAfterAdmin(status: CommentStatus, action: AdminCommentAction): CommentStatus {
  if (action === 'HIDE') return 'HIDDEN_BY_ADMIN';
  return status === 'AUTO_HIDDEN' || status === 'HIDDEN_BY_ADMIN' ? 'VISIBLE' : status;
}
