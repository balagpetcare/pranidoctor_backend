import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ConflictResolutionEngine,
  getConflictResolutionEngine,
  resetConflictResolutionEngineForTests,
  type ApplicableRule,
} from '../recommendation/conflict-resolution.engine.js';
import { CONFLICT_PRIORITY_ORDER } from '../medicine.constants.js';

describe('ConflictResolutionEngine', () => {
  let engine: ConflictResolutionEngine;

  beforeEach(() => {
    resetConflictResolutionEngineForTests();
    engine = getConflictResolutionEngine();
  });

  afterEach(() => {
    resetConflictResolutionEngineForTests();
  });

  describe('resolve', () => {
    it('returns null when no rules are applicable', () => {
      const result = engine.resolve({
        genericId: 'gen-1',
        brandId: 'brand-1',
        region: 'dhaka',
      });

      expect(result).toBeNull();
    });

    it('selects highest priority rule', () => {
      const rules: ApplicableRule[] = [
        {
          type: 'SPONSOR',
          source: 'contract',
          contractId: 'contract-1',
          priority: 100,
          boost: 5,
          reason: 'Sponsor agreement',
        },
        {
          type: 'REGULATORY',
          source: 'governance',
          priority: 1000,
          boost: 0,
          reason: 'Government regulation',
        },
      ];

      const result = engine.sortByPriority(rules);

      expect(result[0].type).toBe('REGULATORY');
    });
  });

  describe('sortByPriority', () => {
    it('sorts rules by priority descending', () => {
      const rules: ApplicableRule[] = [
        { type: 'SPONSOR', source: 'contract', priority: 100, boost: 5, reason: 'Low' },
        { type: 'CAMPAIGN', source: 'contract', priority: 300, boost: 10, reason: 'High' },
        { type: 'REGIONAL', source: 'contract', priority: 200, boost: 7, reason: 'Medium' },
      ];

      const sorted = engine.sortByPriority(rules);

      expect(sorted[0].type).toBe('CAMPAIGN');
      expect(sorted[1].type).toBe('REGIONAL');
      expect(sorted[2].type).toBe('SPONSOR');
    });

    it('uses default priority order when priorities are equal', () => {
      const rules: ApplicableRule[] = [
        { type: 'SPONSOR', source: 'contract', priority: 100, boost: 5, reason: 'Sponsor' },
        { type: 'CAMPAIGN', source: 'contract', priority: 100, boost: 10, reason: 'Campaign' },
      ];

      const sorted = engine.sortByPriority(rules);

      const campaignPriority = CONFLICT_PRIORITY_ORDER.indexOf('CAMPAIGN');
      const sponsorPriority = CONFLICT_PRIORITY_ORDER.indexOf('SPONSOR');

      if (campaignPriority < sponsorPriority) {
        expect(sorted[0].type).toBe('CAMPAIGN');
      } else {
        expect(sorted[0].type).toBe('SPONSOR');
      }
    });
  });

  describe('buildResolutionReason', () => {
    it('builds reason string from winning rule', () => {
      const winner: ApplicableRule = {
        type: 'CAMPAIGN',
        source: 'contract',
        contractId: 'camp-1',
        priority: 300,
        boost: 10,
        reason: 'Active campaign for Q1',
      };

      const reason = engine.buildResolutionReason(winner, []);

      expect(reason).toContain('CAMPAIGN');
      expect(reason).toContain('Active campaign for Q1');
    });

    it('mentions overridden rules', () => {
      const winner: ApplicableRule = {
        type: 'REGULATORY',
        source: 'governance',
        priority: 1000,
        boost: 0,
        reason: 'Government mandate',
      };

      const overridden: ApplicableRule[] = [
        { type: 'SPONSOR', source: 'contract', priority: 100, boost: 5, reason: 'Sponsor deal' },
        { type: 'CAMPAIGN', source: 'contract', priority: 300, boost: 10, reason: 'Campaign' },
      ];

      const reason = engine.buildResolutionReason(winner, overridden);

      expect(reason).toContain('override');
    });
  });

  describe('resolveMultipleSponsors', () => {
    it('selects sponsor with highest boost', () => {
      const sponsors = [
        { companyId: 'comp-1', companyCode: 'COMP1', boost: 5, effectiveDate: new Date() },
        { companyId: 'comp-2', companyCode: 'COMP2', boost: 10, effectiveDate: new Date() },
        { companyId: 'comp-3', companyCode: 'COMP3', boost: 3, effectiveDate: new Date() },
      ];

      const winner = engine.resolveMultipleSponsors(sponsors);

      expect(winner.companyId).toBe('comp-2');
      expect(winner.boost).toBe(10);
    });

    it('uses effective date as tiebreaker', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-06-01');

      const sponsors = [
        { companyId: 'comp-1', companyCode: 'COMP1', boost: 10, effectiveDate: oldDate },
        { companyId: 'comp-2', companyCode: 'COMP2', boost: 10, effectiveDate: newDate },
      ];

      const winner = engine.resolveMultipleSponsors(sponsors);

      expect(winner.companyId).toBe('comp-2');
    });
  });

  describe('resolveOverlappingContracts', () => {
    it('selects contract with highest priority score', () => {
      const contracts = [
        { contractId: 'c1', contractCode: 'CONT1', type: 'SPONSOR' as const, priorityScore: 100 },
        { contractId: 'c2', contractCode: 'CONT2', type: 'CAMPAIGN' as const, priorityScore: 300 },
      ];

      const winner = engine.resolveOverlappingContracts(contracts);

      expect(winner.contractId).toBe('c2');
    });

    it('uses type priority when scores are equal', () => {
      const contracts = [
        { contractId: 'c1', contractCode: 'CONT1', type: 'SPONSOR' as const, priorityScore: 100 },
        { contractId: 'c2', contractCode: 'CONT2', type: 'CAMPAIGN' as const, priorityScore: 100 },
      ];

      const winner = engine.resolveOverlappingContracts(contracts);

      const campaignPriority = CONFLICT_PRIORITY_ORDER.indexOf('CAMPAIGN');
      const sponsorPriority = CONFLICT_PRIORITY_ORDER.indexOf('SPONSOR');

      if (campaignPriority < sponsorPriority) {
        expect(winner.type).toBe('CAMPAIGN');
      }
    });
  });

  describe('checkRegionConflict', () => {
    it('detects conflict when contracts target different regions', () => {
      const contracts = [
        {
          contractId: 'c1',
          targetRegions: ['dhaka', 'chittagong'],
        },
        {
          contractId: 'c2',
          targetRegions: ['sylhet', 'rajshahi'],
        },
      ];

      const hasConflict = engine.checkRegionConflict(contracts, 'dhaka');

      expect(hasConflict).toBe(true);
    });

    it('returns false when all contracts include the region', () => {
      const contracts = [
        {
          contractId: 'c1',
          targetRegions: ['dhaka', 'chittagong'],
        },
        {
          contractId: 'c2',
          targetRegions: ['dhaka', 'sylhet'],
        },
      ];

      const hasConflict = engine.checkRegionConflict(contracts, 'dhaka');

      expect(hasConflict).toBe(false);
    });
  });

  describe('checkOrganizationConflict', () => {
    it('detects conflict when contracts target different organizations', () => {
      const contracts = [
        {
          contractId: 'c1',
          targetOrganizationIds: ['org-1', 'org-2'],
        },
        {
          contractId: 'c2',
          targetOrganizationIds: ['org-3', 'org-4'],
        },
      ];

      const hasConflict = engine.checkOrganizationConflict(contracts, 'org-1');

      expect(hasConflict).toBe(true);
    });

    it('returns false when all contracts include the organization', () => {
      const contracts = [
        {
          contractId: 'c1',
          targetOrganizationIds: ['org-1', 'org-2'],
        },
        {
          contractId: 'c2',
          targetOrganizationIds: ['org-1', 'org-3'],
        },
      ];

      const hasConflict = engine.checkOrganizationConflict(contracts, 'org-1');

      expect(hasConflict).toBe(false);
    });
  });
});
