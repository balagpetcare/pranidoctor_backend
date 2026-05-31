import { getPrisma } from '../../../../shared/database/prisma.js';
import { getBrandRegistryService } from '../knowledge/brand-registry.service.js';
import { getGenericRegistryService } from '../knowledge/generic-registry.service.js';
import { getMedicineKnowledgeRepository } from '../knowledge/medicine-knowledge.repository.js';
import type { MedicineBrandView, MedicineGenericView } from '../medicine.types.js';

export type GenericBrandMapping = {
  genericId: string;
  genericCode: string;
  genericNameEn: string;
  brands: Array<{
    brandId: string;
    brandCode: string;
    brandNameEn: string;
    companyId: string;
    companyNameEn: string;
    form: string;
    strengthValue: string | null;
    strengthUnit: string | null;
    mrpBdt: string | null;
  }>;
};

export type BrandGenericMapping = {
  brandId: string;
  brandCode: string;
  brandNameEn: string;
  generic: {
    genericId: string;
    genericCode: string;
    genericNameEn: string;
    drugClass: string | null;
    therapeuticCategory: string | null;
    prescriptionRequired: boolean;
  };
  company: {
    companyId: string;
    companyCode: string;
    companyNameEn: string;
  };
};

export class GenericBrandMappingService {
  readonly name = 'GenericBrandMappingService';

  private genericRegistry = getGenericRegistryService();
  private brandRegistry = getBrandRegistryService();
  private knowledgeRepo = getMedicineKnowledgeRepository();

  async getBrandsForGeneric(genericId: string): Promise<MedicineBrandView[]> {
    return this.brandRegistry.getBrandsForGeneric(genericId, { isActive: true });
  }

  async getBrandsForGenericCode(genericCode: string): Promise<MedicineBrandView[]> {
    const generic = await this.genericRegistry.findByCode(genericCode);
    if (!generic) return [];
    return this.getBrandsForGeneric(generic.id);
  }

  async getGenericForBrand(brandId: string): Promise<MedicineGenericView | null> {
    const brand = await this.brandRegistry.getById(brandId);
    return this.genericRegistry.getById(brand.genericId);
  }

  async getFullMappingForGeneric(genericId: string): Promise<GenericBrandMapping | null> {
    const generic = await this.genericRegistry.getById(genericId);
    if (!generic) return null;

    const brands = await this.getBrandsForGeneric(genericId);

    return {
      genericId: generic.id,
      genericCode: generic.genericCode,
      genericNameEn: generic.genericNameEn,
      brands: brands.map((b) => ({
        brandId: b.id,
        brandCode: b.brandCode,
        brandNameEn: b.brandNameEn,
        companyId: b.companyId,
        companyNameEn: b.companyNameEn,
        form: b.form,
        strengthValue: b.strengthValue,
        strengthUnit: b.strengthUnit,
        mrpBdt: b.mrpBdt,
      })),
    };
  }

  async getFullMappingForBrand(brandId: string): Promise<BrandGenericMapping | null> {
    const brand = await this.brandRegistry.getById(brandId);
    if (!brand) return null;

    const generic = await this.genericRegistry.getById(brand.genericId);
    if (!generic) return null;

    return {
      brandId: brand.id,
      brandCode: brand.brandCode,
      brandNameEn: brand.brandNameEn,
      generic: {
        genericId: generic.id,
        genericCode: generic.genericCode,
        genericNameEn: generic.genericNameEn,
        drugClass: generic.drugClass,
        therapeuticCategory: generic.therapeuticCategory,
        prescriptionRequired: generic.prescriptionRequired,
      },
      company: {
        companyId: brand.companyId,
        companyCode: brand.companyCode,
        companyNameEn: brand.companyNameEn,
      },
    };
  }

  async findAlternativeBrands(brandId: string): Promise<MedicineBrandView[]> {
    const brand = await this.brandRegistry.getById(brandId);
    const brands = await this.getBrandsForGeneric(brand.genericId);
    return brands.filter((b) => b.id !== brandId);
  }

  async findGenericSubstitutes(genericId: string): Promise<MedicineGenericView[]> {
    const substituteSlugs = await this.knowledgeRepo.getSubstitutes(
      `generic:${(await this.genericRegistry.getById(genericId)).genericCode}`,
    );

    const generics: MedicineGenericView[] = [];
    for (const slug of substituteSlugs) {
      const code = slug.replace('generic:', '');
      const generic = await this.genericRegistry.findByCode(code);
      if (generic && generic.isActive) {
        generics.push(generic);
      }
    }
    return generics;
  }

  async findSameTherapeuticClassGenerics(genericId: string): Promise<MedicineGenericView[]> {
    const generic = await this.genericRegistry.getById(genericId);
    if (!generic.therapeuticCategory) return [];

    const result = await this.genericRegistry.list({
      therapeuticCategory: generic.therapeuticCategory,
      isActive: true,
      limit: 20,
    });

    return result.items.filter((g) => g.id !== genericId);
  }

  async findSameDrugClassGenerics(genericId: string): Promise<MedicineGenericView[]> {
    const generic = await this.genericRegistry.getById(genericId);
    if (!generic.drugClass) return [];

    const result = await this.genericRegistry.list({
      drugClass: generic.drugClass,
      isActive: true,
      limit: 20,
    });

    return result.items.filter((g) => g.id !== genericId);
  }

  async buildMappingIndex(): Promise<Map<string, string[]>> {
    const prisma = getPrisma();
    const brands = await prisma.medicineBrand.findMany({
      where: { isActive: true },
      select: { id: true, genericId: true },
    });

    const index = new Map<string, string[]>();
    for (const brand of brands) {
      const existing = index.get(brand.genericId) ?? [];
      existing.push(brand.id);
      index.set(brand.genericId, existing);
    }

    return index;
  }

  async getMappingStats(): Promise<{
    totalGenerics: number;
    genericsWithBrands: number;
    genericsWithoutBrands: number;
    totalBrands: number;
    avgBrandsPerGeneric: number;
    maxBrandsForGeneric: { genericId: string; count: number } | null;
  }> {
    const index = await this.buildMappingIndex();

    const totalGenerics = await getPrisma().medicineGeneric.count({ where: { isActive: true } });
    const totalBrands = await getPrisma().medicineBrand.count({ where: { isActive: true } });

    const genericsWithBrands = index.size;
    const genericsWithoutBrands = totalGenerics - genericsWithBrands;

    let maxCount = 0;
    let maxGenericId = '';
    let totalCount = 0;

    for (const [genericId, brandIds] of index) {
      totalCount += brandIds.length;
      if (brandIds.length > maxCount) {
        maxCount = brandIds.length;
        maxGenericId = genericId;
      }
    }

    const avgBrandsPerGeneric = genericsWithBrands > 0 ? totalCount / genericsWithBrands : 0;

    return {
      totalGenerics,
      genericsWithBrands,
      genericsWithoutBrands,
      totalBrands,
      avgBrandsPerGeneric: Math.round(avgBrandsPerGeneric * 100) / 100,
      maxBrandsForGeneric: maxGenericId ? { genericId: maxGenericId, count: maxCount } : null,
    };
  }

  async syncGraphEdgesForBrand(brandId: string): Promise<void> {
    const brand = await this.brandRegistry.getById(brandId);
    await this.knowledgeRepo.linkBrandToGeneric(
      brand.brandCode,
      brand.genericCode,
      brand.companyCode,
    );
  }

  async syncAllGraphEdges(): Promise<number> {
    const prisma = getPrisma();
    const brands = await prisma.medicineBrand.findMany({
      where: { isActive: true },
      include: {
        generic: { select: { genericCode: true } },
        company: { select: { companyCode: true } },
      },
    });

    let synced = 0;
    for (const brand of brands) {
      await this.knowledgeRepo.linkBrandToGeneric(
        brand.brandCode,
        brand.generic.genericCode,
        brand.company.companyCode,
      );
      synced++;
    }

    return synced;
  }
}

let service: GenericBrandMappingService | null = null;

export function getGenericBrandMappingService(): GenericBrandMappingService {
  if (!service) service = new GenericBrandMappingService();
  return service;
}

export function resetGenericBrandMappingServiceForTests(): void {
  service = null;
}
