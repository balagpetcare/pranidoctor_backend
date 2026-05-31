import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VetRecommendationService,
  getVetRecommendationService,
  resetVetRecommendationServiceForTests,
} from '../vet-layer/vet-recommendation.service.js';

vi.mock('../recommendation/ranking.engine.js', () => ({
  getRankingEngine: () => ({
    rank: vi.fn().mockResolvedValue({
      query: 'amoxicillin',
      genericId: 'gen-1',
      genericCode: 'AMOX-500',
      species: 'CATTLE',
      region: 'dhaka',
      rankedBrands: [
        {
          brandId: 'brand-1',
          brandCode: 'BRAND1',
          nameEn: 'AmoxBrand',
          nameBn: 'অ্যামক্সব্র্যান্ড',
          companyNameEn: 'ACI',
          baseScore: 50,
          availabilityBonus: 10,
          pricePenalty: 0,
          campaignBoost: 5,
          regionBoost: 0,
          organizationBoost: 0,
          sponsorBoost: 3,
          totalScore: 68,
          contractFactors: [],
          sponsorFactors: [{ companyId: 'comp-1', companyCode: 'ACI', boost: 3 }],
          reasonCodes: ['SPONSOR_BOOST', 'CAMPAIGN_BOOST'],
        },
      ],
      confidence: 0.85,
      isBanned: false,
      explainability: {
        factors: ['Sponsor boost applied', 'Campaign boost applied'],
        warnings: [],
      },
    }),
  }),
}));

vi.mock('../recommendation/conflict-resolution.engine.js', () => ({
  getConflictResolutionEngine: () => ({
    resolve: vi.fn().mockReturnValue(null),
  }),
}));

describe('VetRecommendationService', () => {
  let service: VetRecommendationService;

  beforeEach(() => {
    resetVetRecommendationServiceForTests();
    service = getVetRecommendationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetVetRecommendationServiceForTests();
  });

  describe('getRecommendation', () => {
    it('returns recommendation with disclaimer', async () => {
      const result = await service.getRecommendation({
        query: 'amoxicillin',
        genericCode: 'AMOX-500',
        species: 'CATTLE',
        region: 'dhaka',
        sessionId: 'session-1',
      });

      expect(result.disclaimer).toBeDefined();
      expect(result.disclaimer.length).toBeGreaterThan(0);
    });

    it('includes safety warnings array', async () => {
      const result = await service.getRecommendation({
        query: 'amoxicillin',
        genericCode: 'AMOX-500',
        species: 'CATTLE',
        region: 'dhaka',
        sessionId: 'session-1',
      });

      expect(Array.isArray(result.safetyWarnings)).toBe(true);
    });

    it('indicates when vet approval is required', async () => {
      const result = await service.getRecommendation({
        query: 'amoxicillin',
        genericCode: 'AMOX-500',
        species: 'CATTLE',
        region: 'dhaka',
        sessionId: 'session-1',
      });

      expect(typeof result.vetApprovalRequired).toBe('boolean');
    });

    it('returns ranked brands', async () => {
      const result = await service.getRecommendation({
        query: 'amoxicillin',
        genericCode: 'AMOX-500',
        species: 'CATTLE',
        region: 'dhaka',
        sessionId: 'session-1',
      });

      expect(result.rankedBrands.length).toBeGreaterThan(0);
      expect(result.rankedBrands[0].brandId).toBe('brand-1');
    });

    it('includes sponsor influence flag on brands', async () => {
      const result = await service.getRecommendation({
        query: 'amoxicillin',
        genericCode: 'AMOX-500',
        species: 'CATTLE',
        region: 'dhaka',
        sessionId: 'session-1',
      });

      const brand = result.rankedBrands[0];
      expect(typeof brand.hasSponsorInfluence).toBe('boolean');
    });

    it('includes confidence score', async () => {
      const result = await service.getRecommendation({
        query: 'amoxicillin',
        genericCode: 'AMOX-500',
        species: 'CATTLE',
        region: 'dhaka',
        sessionId: 'session-1',
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('performSafetyCheck', () => {
    it('checks for controlled substances', () => {
      const warnings = service.performSafetyCheck({
        genericCode: 'MORPHINE-10',
        species: 'CATTLE',
        isControlled: true,
        isPrescriptionRequired: true,
      });

      const controlledWarning = warnings.find((w) => w.code === 'CONTROLLED_SUBSTANCE');
      expect(controlledWarning).toBeDefined();
      expect(controlledWarning?.severity).toBe('HIGH');
    });

    it('checks for prescription requirement', () => {
      const warnings = service.performSafetyCheck({
        genericCode: 'ANTIBIOTIC-500',
        species: 'CATTLE',
        isControlled: false,
        isPrescriptionRequired: true,
      });

      const rxWarning = warnings.find((w) => w.code === 'PRESCRIPTION_REQUIRED');
      expect(rxWarning).toBeDefined();
    });

    it('returns empty array for safe medications', () => {
      const warnings = service.performSafetyCheck({
        genericCode: 'VITAMIN-C',
        species: 'CATTLE',
        isControlled: false,
        isPrescriptionRequired: false,
      });

      expect(warnings).toHaveLength(0);
    });
  });

  describe('checkVetApprovalRequired', () => {
    it('requires approval for controlled substances', () => {
      const required = service.checkVetApprovalRequired({
        isControlled: true,
        isPrescriptionRequired: false,
        hasSafetyWarnings: false,
      });

      expect(required).toBe(true);
    });

    it('requires approval for prescription medications', () => {
      const required = service.checkVetApprovalRequired({
        isControlled: false,
        isPrescriptionRequired: true,
        hasSafetyWarnings: false,
      });

      expect(required).toBe(true);
    });

    it('requires approval when safety warnings present', () => {
      const required = service.checkVetApprovalRequired({
        isControlled: false,
        isPrescriptionRequired: false,
        hasSafetyWarnings: true,
      });

      expect(required).toBe(true);
    });

    it('does not require approval for safe OTC medications', () => {
      const required = service.checkVetApprovalRequired({
        isControlled: false,
        isPrescriptionRequired: false,
        hasSafetyWarnings: false,
      });

      expect(required).toBe(false);
    });
  });

  describe('getSafetyReport', () => {
    it('generates comprehensive safety report', async () => {
      const report = await service.getSafetyReport({
        genericCode: 'AMOX-500',
        species: 'CATTLE',
        region: 'dhaka',
      });

      expect(report).toHaveProperty('genericCode');
      expect(report).toHaveProperty('warnings');
      expect(report).toHaveProperty('vetApprovalRequired');
      expect(report).toHaveProperty('disclaimer');
    });
  });
});
