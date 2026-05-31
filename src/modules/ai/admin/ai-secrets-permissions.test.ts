import { describe, expect, it } from 'vitest';

import { aiAdminCan } from './ai-permissions.js';

const superAdmin = { id: 'sa', role: 'SUPER_ADMIN' as const };
const admin = { id: 'ad', role: 'ADMIN' as const };
const support = { id: 'su', role: 'SUPPORT' as const };

describe('ai secrets permissions (Option A)', () => {
  describe('ai.secrets.view', () => {
    it('allows SUPER_ADMIN and ADMIN', () => {
      expect(aiAdminCan(superAdmin, 'ai.secrets.view')).toBe(true);
      expect(aiAdminCan(admin, 'ai.secrets.view')).toBe(true);
    });

    it('denies SUPPORT', () => {
      expect(aiAdminCan(support, 'ai.secrets.view')).toBe(false);
    });
  });

  describe('ai.secrets.manage', () => {
    it('allows SUPER_ADMIN only', () => {
      expect(aiAdminCan(superAdmin, 'ai.secrets.manage')).toBe(true);
      expect(aiAdminCan(admin, 'ai.secrets.manage')).toBe(false);
      expect(aiAdminCan(support, 'ai.secrets.manage')).toBe(false);
    });
  });

  describe('endpoint capability matrix', () => {
    const viewEndpoints = [
      'GET /secrets',
      'GET /secrets/:id',
      'GET /secrets/:id/audit',
      'POST /secrets/:id/test',
      'POST /secrets/:id/disable',
    ] as const;

    const manageEndpoints = [
      'POST /secrets',
      'PUT /secrets/:id',
      'POST /secrets/:id/rotate',
      'PUT /secrets/:id/primary',
    ] as const;

    it('view endpoints: ADMIN allowed, SUPPORT denied', () => {
      for (const route of viewEndpoints) {
        expect(aiAdminCan(admin, 'ai.secrets.view'), route).toBe(true);
        expect(aiAdminCan(support, 'ai.secrets.view'), route).toBe(false);
      }
    });

    it('manage endpoints: SUPER_ADMIN only', () => {
      for (const route of manageEndpoints) {
        expect(aiAdminCan(superAdmin, 'ai.secrets.manage'), route).toBe(true);
        expect(aiAdminCan(admin, 'ai.secrets.manage'), route).toBe(false);
        expect(aiAdminCan(support, 'ai.secrets.manage'), route).toBe(false);
      }
    });
  });
});
