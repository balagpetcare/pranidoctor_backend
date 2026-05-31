import { describe, expect, it } from 'vitest';

import {
  buildSearchText,
  isVersionEditable,
  requiresVetApproval,
} from './knowledge-foundation.types.js';
import {
  computeVersionSignOffHash,
  defaultInlineCitationKey,
  evaluateCitationTrustRules,
} from './knowledge-foundation.util.js';
import { knowledgeFoundationCan } from './permissions/knowledge-foundation.permissions.js';
import { localeBody, localeTitle } from './knowledge-foundation.mapper.js';

describe('knowledge-foundation.types', () => {
  it('requires BN+EN search text generation', () => {
    const text = buildSearchText({
      titleBn: 'মাস্টাইটিস',
      titleEn: 'Mastitis',
      bodyBn: 'লক্ষণ',
      bodyEn: 'signs',
      colloquialBn: ['থনে ফোলা'],
    });
    expect(text).toContain('মাস্টাইটিস');
    expect(text).toContain('Mastitis');
    expect(text).toContain('থনে ফোলা');
  });

  it('blocks edits on published versions', () => {
    expect(isVersionEditable('DRAFT')).toBe(true);
    expect(isVersionEditable('CHANGES_REQUESTED')).toBe(true);
    expect(isVersionEditable('PUBLISHED')).toBe(false);
  });

  it('flags HIGH and CRITICAL for vet approval', () => {
    expect(requiresVetApproval('HIGH')).toBe(true);
    expect(requiresVetApproval('CRITICAL')).toBe(true);
    expect(requiresVetApproval('LOW')).toBe(false);
  });
});

describe('knowledge-foundation.util', () => {
  it('builds stable sign-off hash', () => {
    const version = {
      id: 'v1',
      titleBn: 'a',
      titleEn: 'b',
      bodyBn: 'c',
      bodyEn: 'd',
      structuredJson: null,
      clinicalRiskTier: 'LOW' as const,
    };
    const h1 = computeVersionSignOffHash(version, [
      { id: 'c1', inlineCitationKey: '[dls]', pageRef: '1', sectionRef: null },
    ]);
    const h2 = computeVersionSignOffHash(version, [
      { id: 'c1', inlineCitationKey: '[dls]', pageRef: '1', sectionRef: null },
    ]);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('renders inline citation keys', () => {
    expect(defaultInlineCitationKey('dls-manual', '42')).toBe('[dls-manual|42]');
    expect(defaultInlineCitationKey('dls-manual')).toBe('[dls-manual]');
  });

  it('enforces HIGH risk citation count and locators', () => {
    expect(
      evaluateCitationTrustRules({
        clinicalRiskTier: 'HIGH',
        citations: [{ pageRef: '1', sectionRef: null, sourceTrustTier: 2 }],
      }).ok,
    ).toBe(false);

    expect(
      evaluateCitationTrustRules({
        clinicalRiskTier: 'HIGH',
        citations: [
          { pageRef: '1', sectionRef: 'A', sourceTrustTier: 2 },
          { pageRef: '2', sectionRef: 'B', sourceTrustTier: 2 },
        ],
      }).ok,
    ).toBe(true);
  });
});

describe('knowledge-foundation.mapper locale', () => {
  it('prefers BN locale fields', () => {
    const v = { titleBn: 'বাংলা', titleEn: 'English', bodyBn: 'bn', bodyEn: 'en' };
    expect(localeTitle('bn', v)).toBe('বাংলা');
    expect(localeBody('bn', v)).toBe('bn');
    expect(localeTitle('en', v)).toBe('English');
  });
});

describe('knowledge-foundation.permissions', () => {
  it('grants SUPER_ADMIN publish and audit', () => {
    const actor = { id: '1', role: 'SUPER_ADMIN' };
    expect(knowledgeFoundationCan(actor, 'ai.knowledge.publish')).toBe(true);
    expect(knowledgeFoundationCan(actor, 'ai.knowledge.audit.export')).toBe(true);
  });

  it('denies ADMIN publish', () => {
    const actor = { id: '2', role: 'ADMIN' };
    expect(knowledgeFoundationCan(actor, 'ai.knowledge.edit')).toBe(true);
    expect(knowledgeFoundationCan(actor, 'ai.knowledge.publish')).toBe(false);
    expect(knowledgeFoundationCan(actor, 'ai.knowledge.approve')).toBe(false);
  });

  it('denies INTERNAL default role all elevated capabilities', () => {
    const actor = { id: '1', role: 'INTERNAL' };
    expect(knowledgeFoundationCan(actor, 'ai.knowledge.view')).toBe(false);
    expect(knowledgeFoundationCan(actor, 'ai.knowledge.publish')).toBe(false);
  });
});
