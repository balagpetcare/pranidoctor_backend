import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GenericBrandMappingService,
  getGenericBrandMappingService,
  resetGenericBrandMappingServiceForTests,
} from '../mapping/generic-brand-mapping.service.js';

vi.mock('../knowledge/generic-registry.service.js', () => ({
  getGenericRegistryService: () => ({
    getByCode: vi.fn().mockResolvedValue({
      id: 'gen-1',
      genericCode: 'AMOX-500',
      nameBn: 'অ্যামোক্সিসিলিন',
      nameEn: 'Amoxicillin',
      drugClass: 'ANTIBIOTIC',
    }),
    findByCode: vi.fn().mockResolvedValue({
      id: 'gen-1',
      genericCode: 'AMOX-500',
    }),
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  }),
}));

vi.mock('../knowledge/brand-registry.service.js', () => ({
  getBrandRegistryService: () => ({
    getByCode: vi.fn().mockResolvedValue({
      id: 'brand-1',
      brandCode: 'AMOXBRAND',
      nameBn: 'অ্যামক্সব্র্যান্ড',
      nameEn: 'AmoxBrand',
      genericId: 'gen-1',
    }),
    findByCode: vi.fn().mockResolvedValue({
      id: 'brand-1',
      brandCode: 'AMOXBRAND',
      genericId: 'gen-1',
    }),
    getBrandsForGeneric: vi.fn().mockResolvedValue([
      {
        id: 'brand-1',
        brandCode: 'AMOXBRAND',
        nameBn: 'অ্যামক্সব্র্যান্ড',
        nameEn: 'AmoxBrand',
        companyNameEn: 'ACI',
      },
      {
        id: 'brand-2',
        brandCode: 'AMOX2',
        nameBn: 'অ্যামক্স২',
        nameEn: 'Amox2',
        companyNameEn: 'Square',
      },
    ]),
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  }),
}));

vi.mock('../knowledge/medicine-knowledge.repository.js', () => ({
  getMedicineKnowledgeRepository: () => ({
    getBrandsForGenericBySlug: vi.fn().mockResolvedValue([]),
    getGenericsForBrandBySlug: vi.fn().mockResolvedValue([]),
    getSubstitutes: vi.fn().mockResolvedValue([]),
    getSameTherapeuticClass: vi.fn().mockResolvedValue([]),
    getSameDrugClass: vi.fn().mockResolvedValue([]),
    linkBrandToGeneric: vi.fn(),
    getEdgeStats: vi.fn().mockResolvedValue({ total: 0, byEdgeType: {} }),
  }),
}));

describe('GenericBrandMappingService', () => {
  let service: GenericBrandMappingService;

  beforeEach(() => {
    resetGenericBrandMappingServiceForTests();
    service = getGenericBrandMappingService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetGenericBrandMappingServiceForTests();
  });

  describe('getBrandsForGeneric', () => {
    it('returns brands for a generic by ID', async () => {
      const result = await service.getBrandsForGeneric('gen-1');

      expect(result).toHaveLength(2);
      expect(result[0].brandCode).toBe('AMOXBRAND');
    });
  });

  describe('getBrandsForGenericCode', () => {
    it('returns brands for a generic by code', async () => {
      const result = await service.getBrandsForGenericCode('AMOX-500');

      expect(result).toBeDefined();
    });
  });

  describe('getGenericForBrand', () => {
    it('returns generic for a brand', async () => {
      const result = await service.getGenericForBrand('brand-1');

      expect(result).toBeDefined();
    });
  });

  describe('getFullMappingForGeneric', () => {
    it('returns full mapping with brands and alternatives', async () => {
      const result = await service.getFullMappingForGeneric('AMOX-500');

      expect(result).toHaveProperty('generic');
      expect(result).toHaveProperty('brands');
      expect(result).toHaveProperty('substitutes');
      expect(result).toHaveProperty('sameTherapeuticClass');
      expect(result).toHaveProperty('sameDrugClass');
    });
  });

  describe('getFullMappingForBrand', () => {
    it('returns full mapping from brand perspective', async () => {
      const result = await service.getFullMappingForBrand('AMOXBRAND');

      expect(result).toHaveProperty('brand');
      expect(result).toHaveProperty('generic');
      expect(result).toHaveProperty('alternativeBrands');
    });
  });

  describe('findAlternativeBrands', () => {
    it('finds alternative brands excluding current', async () => {
      const result = await service.findAlternativeBrands('gen-1', 'brand-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findGenericSubstitutes', () => {
    it('finds substitute generics', async () => {
      const result = await service.findGenericSubstitutes('gen-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findSameTherapeuticClassGenerics', () => {
    it('finds generics in same therapeutic class', async () => {
      const result = await service.findSameTherapeuticClassGenerics('gen-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findSameDrugClassGenerics', () => {
    it('finds generics in same drug class', async () => {
      const result = await service.findSameDrugClassGenerics('gen-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getMappingStats', () => {
    it('returns mapping statistics', async () => {
      const result = await service.getMappingStats();

      expect(result).toHaveProperty('totalGenerics');
      expect(result).toHaveProperty('totalBrands');
      expect(result).toHaveProperty('graphEdges');
    });
  });
});
