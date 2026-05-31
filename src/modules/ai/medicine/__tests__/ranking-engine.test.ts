import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RankingEngine,
  getRankingEngine,
  resetRankingEngineForTests,
} from '../recommendation/ranking.engine.js';
import { MEDICINE_RANKING_CONFIG, AVAILABILITY_SCORE_MAP } from '../medicine.constants.js';

vi.mock('../knowledge/medicine-knowledge.service.js', () => ({
  getMedicineKnowledgeService: () => ({
    resolveGeneric: vi.fn(),
    getEligibleBrandsForGeneric: vi.fn(),
    isGenericBanned: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('../contracts/contract-evaluation.engine.js', () => ({
  getContractEvaluationEngine: () => ({
    evaluateForMultipleBrands: vi.fn().mockResolvedValue({}),
  }),
}));

describe('RankingEngine', () => {
  let engine: RankingEngine;

  beforeEach(() => {
    resetRankingEngineForTests();
    engine = getRankingEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetRankingEngineForTests();
  });

  describe('calculateAvailabilityBonus', () => {
    it('returns correct bonus for HIGH availability', () => {
      const bonus = engine.calculateAvailabilityBonus('HIGH');
      expect(bonus).toBe(AVAILABILITY_SCORE_MAP.HIGH);
    });

    it('returns correct bonus for MODERATE availability', () => {
      const bonus = engine.calculateAvailabilityBonus('MODERATE');
      expect(bonus).toBe(AVAILABILITY_SCORE_MAP.MODERATE);
    });

    it('returns correct bonus for LOW availability', () => {
      const bonus = engine.calculateAvailabilityBonus('LOW');
      expect(bonus).toBe(AVAILABILITY_SCORE_MAP.LOW);
    });

    it('returns zero for DISCONTINUED', () => {
      const bonus = engine.calculateAvailabilityBonus('DISCONTINUED');
      expect(bonus).toBe(0);
    });

    it('returns zero for null', () => {
      const bonus = engine.calculateAvailabilityBonus(null);
      expect(bonus).toBe(0);
    });
  });

  describe('calculatePricePenalty', () => {
    it('returns zero penalty for price below threshold', () => {
      const penalty = engine.calculatePricePenalty(100);
      expect(penalty).toBe(0);
    });

    it('returns penalty for price above threshold', () => {
      const highPrice = MEDICINE_RANKING_CONFIG.priceThresholdBdt + 100;
      const penalty = engine.calculatePricePenalty(highPrice);
      expect(penalty).toBeGreaterThan(0);
    });

    it('returns zero for null price', () => {
      const penalty = engine.calculatePricePenalty(null);
      expect(penalty).toBe(0);
    });
  });

  describe('extractCampaignBoost', () => {
    it('extracts campaign boost from factors', () => {
      const factors = [
        { source: 'contract' as const, type: 'CAMPAIGN' as const, boost: 10 },
        { source: 'contract' as const, type: 'SPONSOR' as const, boost: 5 },
      ];
      const boost = engine.extractCampaignBoost(factors);
      expect(boost).toBe(10);
    });

    it('returns zero when no campaign factor', () => {
      const factors = [{ source: 'contract' as const, type: 'SPONSOR' as const, boost: 5 }];
      const boost = engine.extractCampaignBoost(factors);
      expect(boost).toBe(0);
    });
  });

  describe('extractRegionBoost', () => {
    it('extracts region boost from factors', () => {
      const factors = [
        { source: 'contract' as const, type: 'REGIONAL' as const, boost: 7 },
      ];
      const boost = engine.extractRegionBoost(factors);
      expect(boost).toBe(7);
    });
  });

  describe('extractOrganizationBoost', () => {
    it('extracts organization boost from factors', () => {
      const factors = [
        { source: 'contract' as const, type: 'ORGANIZATION' as const, boost: 8 },
      ];
      const boost = engine.extractOrganizationBoost(factors);
      expect(boost).toBe(8);
    });
  });

  describe('generateReasonCodes', () => {
    it('generates reason codes based on factors', () => {
      const rankedBrand = {
        brandId: 'brand-1',
        brandCode: 'BRAND1',
        nameEn: 'Brand One',
        nameBn: 'ব্র্যান্ড ওয়ান',
        companyNameEn: 'Company One',
        baseScore: 50,
        availabilityBonus: 10,
        pricePenalty: -5,
        campaignBoost: 5,
        regionBoost: 3,
        organizationBoost: 2,
        sponsorBoost: 4,
        totalScore: 69,
        contractFactors: [
          { contractId: 'c1', contractCode: 'CAMP1', type: 'CAMPAIGN' as const, boost: 5 },
        ],
        sponsorFactors: [
          { companyId: 'comp1', companyCode: 'COMP1', boost: 4 },
        ],
        reasonCodes: [],
      };

      const reasons = engine.generateReasonCodes(rankedBrand);
      
      expect(reasons).toContain('CAMPAIGN_BOOST');
      expect(reasons).toContain('SPONSOR_BOOST');
      expect(reasons).toContain('AVAILABILITY_BONUS');
    });

    it('includes REGION_BOOST when applicable', () => {
      const rankedBrand = {
        brandId: 'brand-1',
        brandCode: 'BRAND1',
        nameEn: 'Brand One',
        nameBn: 'ব্র্যান্ড ওয়ান',
        companyNameEn: 'Company One',
        baseScore: 50,
        availabilityBonus: 0,
        pricePenalty: 0,
        campaignBoost: 0,
        regionBoost: 5,
        organizationBoost: 0,
        sponsorBoost: 0,
        totalScore: 55,
        contractFactors: [],
        sponsorFactors: [],
        reasonCodes: [],
      };

      const reasons = engine.generateReasonCodes(rankedBrand);
      
      expect(reasons).toContain('REGION_BOOST');
    });
  });

  describe('calculateConfidence', () => {
    it('returns high confidence when there are many brands', () => {
      const rankedBrands = Array.from({ length: 5 }, (_, i) => ({
        brandId: `brand-${i}`,
        brandCode: `BRAND${i}`,
        nameEn: `Brand ${i}`,
        nameBn: `ব্র্যান্ড ${i}`,
        companyNameEn: 'Company',
        baseScore: 50 - i * 5,
        availabilityBonus: 5,
        pricePenalty: 0,
        campaignBoost: 0,
        regionBoost: 0,
        organizationBoost: 0,
        sponsorBoost: 0,
        totalScore: 55 - i * 5,
        contractFactors: [],
        sponsorFactors: [],
        reasonCodes: [],
      }));

      const confidence = engine.calculateConfidence(rankedBrands);
      
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('returns lower confidence when brands have similar scores', () => {
      const rankedBrands = Array.from({ length: 3 }, (_, i) => ({
        brandId: `brand-${i}`,
        brandCode: `BRAND${i}`,
        nameEn: `Brand ${i}`,
        nameBn: `ব্র্যান্ড ${i}`,
        companyNameEn: 'Company',
        baseScore: 50,
        availabilityBonus: 5,
        pricePenalty: 0,
        campaignBoost: 0,
        regionBoost: 0,
        organizationBoost: 0,
        sponsorBoost: 0,
        totalScore: 55,
        contractFactors: [],
        sponsorFactors: [],
        reasonCodes: [],
      }));

      const confidence = engine.calculateConfidence(rankedBrands);
      
      expect(confidence).toBeLessThan(0.9);
    });

    it('returns minimum confidence for empty brands', () => {
      const confidence = engine.calculateConfidence([]);
      
      expect(confidence).toBe(0);
    });
  });

  describe('createBannedResult', () => {
    it('creates result with banned status', () => {
      const result = engine.createBannedResult({
        query: 'test-drug',
        genericId: 'gen-1',
        reason: 'Regulatory ban',
      });

      expect(result.isBanned).toBe(true);
      expect(result.rankedBrands).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe('createEmptyResult', () => {
    it('creates result with no brands', () => {
      const result = engine.createEmptyResult({
        query: 'test-drug',
        genericId: 'gen-1',
        reason: 'No brands available',
      });

      expect(result.rankedBrands).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.isBanned).toBe(false);
    });
  });
});
