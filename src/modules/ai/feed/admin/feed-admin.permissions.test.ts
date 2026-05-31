import { describe, expect, it } from 'vitest';

import type { AiAdminActor } from '../../admin/ai-admin.guard.js';
import { aiAdminCan } from '../../admin/ai-permissions.js';
import { feedAdminCan } from './feed-admin.permissions.js';

function actor(role: string): AiAdminActor {
  return { id: 'admin-1', role };
}

describe('feed admin permissions', () => {
  it('grants SUPER_ADMIN all feed capabilities', () => {
    expect(feedAdminCan(actor('SUPER_ADMIN'), 'ai.feed.view')).toBe(true);
    expect(feedAdminCan(actor('SUPER_ADMIN'), 'ai.feed.manage')).toBe(true);
    expect(feedAdminCan(actor('SUPER_ADMIN'), 'ai.feed.publish')).toBe(true);
    expect(feedAdminCan(actor('SUPER_ADMIN'), 'ai.feed.audit')).toBe(true);
  });

  it('limits SUPPORT to view and audit', () => {
    expect(feedAdminCan(actor('SUPPORT'), 'ai.feed.view')).toBe(true);
    expect(feedAdminCan(actor('SUPPORT'), 'ai.feed.audit')).toBe(true);
    expect(feedAdminCan(actor('SUPPORT'), 'ai.feed.manage')).toBe(false);
    expect(feedAdminCan(actor('SUPPORT'), 'ai.feed.publish')).toBe(false);
  });

  it('registers feed keys in ai admin capability union', () => {
    expect(aiAdminCan(actor('ADMIN'), 'ai.feed.manage')).toBe(true);
  });

  it('documents policy A — SUPPORT is read-only for feed admin', () => {
    const support = actor('SUPPORT');
    expect(feedAdminCan(support, 'ai.feed.view')).toBe(true);
    expect(feedAdminCan(support, 'ai.feed.audit')).toBe(true);
    expect(feedAdminCan(support, 'ai.feed.manage')).toBe(false);
    expect(feedAdminCan(support, 'ai.feed.publish')).toBe(false);
  });
});
