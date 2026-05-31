import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getCompanyRegistryService, type CompanyRegistryService } from './company-registry.service.js';
import { getGenericRegistryService, type GenericRegistryService } from './generic-registry.service.js';
import { getBrandRegistryService, type BrandRegistryService } from './brand-registry.service.js';
import type {
  VetCompanyView,
  MedicineGenericView,
  MedicineBrandView,
} from '../medicine.types.js';

export type MedicineKnowledgeStats = {
  totalCompanies: number;
  activeCompanies: number;
  verifiedCompanies: number;
  totalGenerics: number;
  activeGenerics: number;
  totalBrands: number;
  activeBrands: number;
  brandsByForm: Record<string, number>;
  brandsByAvailability: Record<string, number>;
};

export type GenericWithBrands = MedicineGenericView & {
  brands: MedicineBrandView[];
};

export class MedicineKnowledgeService {
  readonly name = 'MedicineKnowledgeService';

  private companyRegistry: CompanyRegistryService;
  private genericRegistry: GenericRegistryService;
  private brandRegistry: BrandRegistryService;

  constructor() {
    this.companyRegistry = getCompanyRegistryService();
    this.genericRegistry = getGenericRegistryService();
    this.brandRegistry = getBrandRegistryService();
  }

  getCompanyRegistry(): CompanyRegistryService {
    return this.companyRegistry;
  }

  getGenericRegistry(): GenericRegistryService {
    return this.genericRegistry;
  }

  getBrandRegistry(): BrandRegistryService {
    return this.brandRegistry;
  }

  async getStats(): Promise<MedicineKnowledgeStats> {
    const [companies, generics, brands] = await Promise.all([
      this.companyRegistry.list({ limit: 1 }),
      this.genericRegistry.list({ limit: 1 }),
      this.brandRegistry.list({ limit: 1 }),
    ]);

    const [activeCompanies, verifiedCompanies] = await Promise.all([
      this.companyRegistry.list({ status: 'ACTIVE', limit: 1 }),
      this.companyRegistry.list({ isVerified: true, limit: 1 }),
    ]);

    const [activeGenerics, activeBrands] = await Promise.all([
      this.genericRegistry.list({ isActive: true, limit: 1 }),
      this.brandRegistry.list({ isActive: true, limit: 1 }),
    ]);

    return {
      totalCompanies: companies.total,
      activeCompanies: activeCompanies.total,
      verifiedCompanies: verifiedCompanies.total,
      totalGenerics: generics.total,
      activeGenerics: activeGenerics.total,
      totalBrands: brands.total,
      activeBrands: activeBrands.total,
      brandsByForm: {},
      brandsByAvailability: {},
    };
  }

  async getGenericWithBrands(genericId: string): Promise<GenericWithBrands> {
    const [generic, brands] = await Promise.all([
      this.genericRegistry.getById(genericId),
      this.brandRegistry.getBrandsForGeneric(genericId),
    ]);

    return { ...generic, brands };
  }

  async getGenericWithBrandsByCode(genericCode: string): Promise<GenericWithBrands> {
    const generic = await this.genericRegistry.getByCode(genericCode);
    const brands = await this.brandRegistry.getBrandsForGeneric(generic.id);
    return { ...generic, brands };
  }

  async searchMedicines(query: string, options?: {
    species?: LivestockSpecies;
    limit?: number;
  }): Promise<{
    generics: MedicineGenericView[];
    brands: MedicineBrandView[];
  }> {
    const [generics, brands] = await Promise.all([
      this.genericRegistry.searchByName(query, {
        species: options?.species,
        limit: options?.limit ?? 10,
      }),
      this.brandRegistry.searchByName(query, {
        limit: options?.limit ?? 10,
      }),
    ]);

    return { generics, brands };
  }

  async getCompanyWithBrands(companyId: string): Promise<VetCompanyView & { brands: MedicineBrandView[] }> {
    const [company, brands] = await Promise.all([
      this.companyRegistry.getById(companyId),
      this.brandRegistry.getBrandsForCompany(companyId),
    ]);

    return { ...company, brands };
  }

  async resolveGeneric(params: {
    genericId?: string;
    genericCode?: string;
    query?: string;
    species?: LivestockSpecies;
  }): Promise<MedicineGenericView | null> {
    if (params.genericId) {
      try {
        return await this.genericRegistry.getById(params.genericId);
      } catch {
        return null;
      }
    }

    if (params.genericCode) {
      return this.genericRegistry.findByCode(params.genericCode);
    }

    if (params.query) {
      const results = await this.genericRegistry.searchByName(params.query, {
        species: params.species,
        limit: 1,
      });
      return results[0] ?? null;
    }

    return null;
  }

  async getEligibleBrandsForGeneric(
    genericId: string,
    options?: {
      region?: string;
      organizationId?: string;
    },
  ): Promise<MedicineBrandView[]> {
    const brands = await this.brandRegistry.getBrandsForGeneric(genericId, { isActive: true });
    return brands;
  }

  async isGenericBanned(genericId: string): Promise<boolean> {
    try {
      const generic = await this.genericRegistry.getById(genericId);
      return generic.bannedSubstance;
    } catch {
      return false;
    }
  }

  async isGenericControlled(genericId: string): Promise<boolean> {
    try {
      const generic = await this.genericRegistry.getById(genericId);
      return generic.controlledSubstance;
    } catch {
      return false;
    }
  }

  async getGenericsByDrugClass(drugClass: string): Promise<MedicineGenericView[]> {
    return this.genericRegistry.getByDrugClass(drugClass);
  }

  async getGenericsByTherapeuticCategory(category: string): Promise<MedicineGenericView[]> {
    return this.genericRegistry.getByTherapeuticCategory(category);
  }
}

let service: MedicineKnowledgeService | null = null;

export function getMedicineKnowledgeService(): MedicineKnowledgeService {
  if (!service) service = new MedicineKnowledgeService();
  return service;
}

export function resetMedicineKnowledgeServiceForTests(): void {
  service = null;
}
