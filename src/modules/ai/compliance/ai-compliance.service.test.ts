import { describe, expect, it, vi } from 'vitest';

import {
  buildAiComplianceMetadata,
  mapBucketToComplianceRisk,
} from './ai-compliance.service.js';

vi.mock('../../../legacy/web/lib/ai-compliance/ai-compliance-config.js', () => ({
  loadAiComplianceConfig: vi.fn(async () => ({
    contentVersion: '2026-05-30.1',
    enabled: true,
    auditEnabled: true,
    emergencyDetectionEnabled: true,
  })),
}));

vi.mock('../../../legacy/web/lib/ai-disclaimer/ai-disclaimer-config.js', () => ({
  loadAiDisclaimerConfig: vi.fn(async () => ({
    contentVersion: '2026-05-30.1',
    enforceAcceptance: true,
    banner: { en: 'banner', bn: 'banner' },
    contextual: {
      chat: { en: 'chat', bn: 'chat' },
      recommendations: { en: 'recs', bn: 'recs' },
      advisory: { en: 'adv', bn: 'adv' },
    },
  })),
}));

describe('ai-compliance.service', () => {
  it('maps risk buckets', () => {
    expect(mapBucketToComplianceRisk('HIGH')).toBe('HIGH');
  });

  it('builds emergency compliance metadata', async () => {
    const meta = await buildAiComplianceMetadata({
      feature: 'triage',
      riskLevel: 'HIGH',
      emergency: true,
      escalationRequired: true,
    });
    expect(meta.emergency).toBe(true);
    expect(meta.showUrgentBanner).toBe(true);
    expect(meta.showEscalationStrip).toBe(true);
  });
});
