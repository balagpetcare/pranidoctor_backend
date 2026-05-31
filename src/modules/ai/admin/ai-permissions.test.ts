import { describe, expect, it } from 'vitest';

import { aiAdminCan, assertAiAdminCan } from './ai-permissions.js';

describe('ai-permissions', () => {
  it('grants SUPER_ADMIN all foundation capabilities', () => {
    const actor = { id: 'u1', role: 'SUPER_ADMIN' };
    expect(aiAdminCan(actor, 'ai.foundation.manage')).toBe(true);
    expect(aiAdminCan(actor, 'ai.secrets.view')).toBe(true);
    expect(aiAdminCan(actor, 'ai.secrets.manage')).toBe(true);
    expect(aiAdminCan(actor, 'ai.settings.manage')).toBe(true);
  });

  it('grants ADMIN secrets view but not manage or foundation', () => {
    const actor = { id: 'u2', role: 'ADMIN' };
    expect(aiAdminCan(actor, 'ai.settings.manage')).toBe(true);
    expect(aiAdminCan(actor, 'ai.secrets.view')).toBe(true);
    expect(aiAdminCan(actor, 'ai.secrets.manage')).toBe(false);
    expect(aiAdminCan(actor, 'ai.foundation.manage')).toBe(false);
  });

  it('denies SUPPORT all secrets capabilities', () => {
    const actor = { id: 'u3', role: 'SUPPORT' };
    expect(aiAdminCan(actor, 'ai.secrets.view')).toBe(false);
    expect(aiAdminCan(actor, 'ai.secrets.manage')).toBe(false);
  });

  it('returns 403 response when capability missing', () => {
    const denied = assertAiAdminCan({ id: 'u2', role: 'ADMIN' }, 'ai.foundation.manage');
    expect(denied).not.toBeNull();
    expect(denied?.status).toBe(403);
  });
});
