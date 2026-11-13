import { describe, expect, it } from 'vitest';

import { checkCommentBody, ownerToggle, statusAfterAdmin, statusAfterReport, viewerCanSeeComment } from './comment.rules.js';

describe('checkCommentBody', () => {
  it('rejects empty and over-long', () => {
    expect(checkCommentBody('   ')).not.toBeNull();
    expect(checkCommentBody('a'.repeat(1001))).not.toBeNull();
    expect(checkCommentBody('ঠিক আছে')).toBeNull();
  });
});

describe('viewerCanSeeComment', () => {
  const base = { isAuthor: false, isQuestionOwner: false };
  it('visible to everyone', () => expect(viewerCanSeeComment({ status: 'VISIBLE', ...base })).toBe(true));
  it('owner-hidden: author and asker only', () => {
    expect(viewerCanSeeComment({ status: 'HIDDEN_BY_OWNER', ...base })).toBe(false);
    expect(viewerCanSeeComment({ status: 'HIDDEN_BY_OWNER', ...base, isQuestionOwner: true })).toBe(true);
    expect(viewerCanSeeComment({ status: 'HIDDEN_BY_OWNER', ...base, isAuthor: true })).toBe(true);
  });
  it('auto/admin hidden: author only', () => {
    for (const status of ['AUTO_HIDDEN', 'HIDDEN_BY_ADMIN'] as const) {
      expect(viewerCanSeeComment({ status, ...base, isQuestionOwner: true })).toBe(false);
      expect(viewerCanSeeComment({ status, ...base, isAuthor: true })).toBe(true);
    }
  });
});

describe('ownerToggle', () => {
  it('flips only owner-level hides', () => {
    expect(ownerToggle('VISIBLE', true)).toBe('HIDDEN_BY_OWNER');
    expect(ownerToggle('HIDDEN_BY_OWNER', false)).toBe('VISIBLE');
    expect(ownerToggle('AUTO_HIDDEN', false)).toBeNull();
    expect(ownerToggle('HIDDEN_BY_ADMIN', false)).toBeNull();
    expect(ownerToggle('AUTO_HIDDEN', true)).toBeNull();
  });
});

describe('statusAfterReport', () => {
  it('auto-hides at the threshold', () => {
    expect(statusAfterReport('VISIBLE', 2, 3)).toBe('VISIBLE');
    expect(statusAfterReport('VISIBLE', 3, 3)).toBe('AUTO_HIDDEN');
  });
  it('never un-hides or downgrades other states', () => {
    expect(statusAfterReport('HIDDEN_BY_ADMIN', 9, 3)).toBe('HIDDEN_BY_ADMIN');
    expect(statusAfterReport('HIDDEN_BY_OWNER', 9, 3)).toBe('HIDDEN_BY_OWNER');
  });
});

describe('statusAfterAdmin', () => {
  it('dismiss restores auto-hidden, hide is final', () => {
    expect(statusAfterAdmin('AUTO_HIDDEN', 'DISMISS')).toBe('VISIBLE');
    expect(statusAfterAdmin('HIDDEN_BY_OWNER', 'DISMISS')).toBe('HIDDEN_BY_OWNER');
    expect(statusAfterAdmin('VISIBLE', 'HIDE')).toBe('HIDDEN_BY_ADMIN');
  });
});
