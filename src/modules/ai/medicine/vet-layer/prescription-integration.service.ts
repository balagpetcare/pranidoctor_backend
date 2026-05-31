import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getVetRecommendationService } from './vet-recommendation.service.js';
import { getGenericRegistryService } from '../knowledge/generic-registry.service.js';
import { getBrandRegistryService } from '../knowledge/brand-registry.service.js';
import { getGenericBrandMappingService } from '../mapping/generic-brand-mapping.service.js';
import type { RankedBrand, MedicineGenericView, MedicineBrandView } from '../medicine.types.js';

export type MedicineRecommendationContext = {
  genericSlug?: string;
  genericCode?: string;
  drugSlug?: string;
  species?: LivestockSpecies;
  region?: string;
  organizationId?: string;
  customerId?: string;
  userId?: string;
  sessionId?: string;
};

export type MedicineRecommendationForPrescription = {
  generic: {
    id: string;
    code: string;
    nameEn: string;
    nameBn: string;
    drugClass: string | null;
    prescriptionRequired: boolean;
    withdrawalMeatDays: number | null;
    withdrawalMilkDays: number | null;
  } | null;
  rankedBrands: Array<{
    id: string;
    code: string;
    nameEn: string;
    nameBn: string;
    companyNameEn: string;
    mrpBdt: string | null;
    form: string;
    strength: string | null;
    totalScore: number;
    hasSponsorInfluence: boolean;
    reasonCodes: string[];
  }>;
  safetyWarnings: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
  disclaimer: string;
  confidence: number;
};

export class PrescriptionIntegrationService {
  readonly name = 'PrescriptionIntegrationService';

  private vetRecommendation = getVetRecommendationService();
  private genericRegistry = getGenericRegistryService();
  private brandRegistry = getBrandRegistryService();
  private mappingService = getGenericBrandMappingService();

  async getRecommendationsForDrugSlug(
    drugSlug: string,
    context: Omit<MedicineRecommendationContext, 'drugSlug'>,
  ): Promise<MedicineRecommendationForPrescription> {
    const genericCode = this.slugToGenericCode(drugSlug);

    const generic = await this.genericRegistry.findByCode(genericCode);
    if (!generic) {
      return this.createEmptyRecommendation(`Generic not found for slug: ${drugSlug}`);
    }

    return this.getRecommendationsForGeneric(generic.id, context);
  }

  async getRecommendationsForGeneric(
    genericId: string,
    context: Omit<MedicineRecommendationContext, 'genericId'>,
  ): Promise<MedicineRecommendationForPrescription> {
    const response = await this.vetRecommendation.getRecommendation({
      genericId,
      species: context.species,
      region: context.region,
      organizationId: context.organizationId,
      customerId: context.customerId,
      userId: context.userId,
      sessionId: context.sessionId,
      limit: 10,
    });

    if (!response.success || !response.recommendation) {
      return this.createEmptyRecommendation(
        response.safetyWarnings[0]?.message ?? 'No recommendation available',
      );
    }

    const rec = response.recommendation;
    let generic: MedicineGenericView | null = null;
    try {
      generic = await this.genericRegistry.getById(rec.genericId);
    } catch {
      // Generic not found
    }

    return {
      generic: generic
        ? {
            id: generic.id,
            code: generic.genericCode,
            nameEn: generic.genericNameEn,
            nameBn: generic.genericNameBn,
            drugClass: generic.drugClass,
            prescriptionRequired: generic.prescriptionRequired,
            withdrawalMeatDays: generic.defaultWithdrawalMeatDays,
            withdrawalMilkDays: generic.defaultWithdrawalMilkDays,
          }
        : null,
      rankedBrands: rec.rankedBrands.map((brand) => ({
        id: brand.brandId,
        code: brand.brandCode,
        nameEn: brand.brandNameEn,
        nameBn: brand.brandNameBn,
        companyNameEn: brand.companyNameEn,
        mrpBdt: brand.mrpBdt,
        form: brand.form,
        strength: brand.strengthValue
          ? `${brand.strengthValue}${brand.strengthUnit ?? ''}`
          : null,
        totalScore: brand.totalScore,
        hasSponsorInfluence: brand.sponsorFactors.length > 0,
        reasonCodes: brand.reasonCodes,
      })),
      safetyWarnings: response.safetyWarnings.map((w) => ({
        code: w.code,
        severity: w.severity,
        message: w.message,
      })),
      disclaimer: response.disclaimer,
      confidence: rec.confidence,
    };
  }

  async enrichDrugMatchWithBrands(
    drugMatch: { entityId: string; slug: string; genericName: string },
    context: { species?: LivestockSpecies; region?: string },
  ): Promise<{
    drugMatch: typeof drugMatch;
    brands: MedicineBrandView[];
    hasBrandsAvailable: boolean;
  }> {
    const genericCode = this.slugToGenericCode(drugMatch.slug);
    const generic = await this.genericRegistry.findByCode(genericCode);

    if (!generic) {
      return {
        drugMatch,
        brands: [],
        hasBrandsAvailable: false,
      };
    }

    const brands = await this.brandRegistry.getBrandsForGeneric(generic.id, { isActive: true });

    return {
      drugMatch,
      brands,
      hasBrandsAvailable: brands.length > 0,
    };
  }

  async getAlternativeBrandsForDrug(
    drugSlug: string,
    currentBrandId: string,
    context: { species?: LivestockSpecies; region?: string },
  ): Promise<MedicineBrandView[]> {
    const genericCode = this.slugToGenericCode(drugSlug);
    const generic = await this.genericRegistry.findByCode(genericCode);

    if (!generic) return [];

    const alternatives = await this.mappingService.findAlternativeBrands(currentBrandId);
    return alternatives;
  }

  async checkDrugAvailabilityInRegion(
    drugSlug: string,
    region: string,
  ): Promise<{
    available: boolean;
    brands: MedicineBrandView[];
    alternativeRegions: string[];
  }> {
    const genericCode = this.slugToGenericCode(drugSlug);
    const generic = await this.genericRegistry.findByCode(genericCode);

    if (!generic) {
      return { available: false, brands: [], alternativeRegions: [] };
    }

    const allBrands = await this.brandRegistry.getBrandsForGeneric(generic.id, { isActive: true });

    const availableBrands = allBrands.filter((b) => {
      const regionAvailability = b.regionAvailabilityJson as Record<string, boolean> | null;
      if (!regionAvailability) return true;
      return regionAvailability[region] !== false;
    });

    return {
      available: availableBrands.length > 0,
      brands: availableBrands,
      alternativeRegions: [],
    };
  }

  private slugToGenericCode(slug: string): string {
    return slug
      .toUpperCase()
      .replace(/-/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  private createEmptyRecommendation(message: string): MedicineRecommendationForPrescription {
    return {
      generic: null,
      rankedBrands: [],
      safetyWarnings: [
        {
          code: 'NO_RECOMMENDATION',
          severity: 'INFO',
          message,
        },
      ],
      disclaimer: 'This is assistive information only. Consult a veterinarian for treatment decisions.',
      confidence: 0,
    };
  }
}

let service: PrescriptionIntegrationService | null = null;

export function getPrescriptionIntegrationService(): PrescriptionIntegrationService {
  if (!service) service = new PrescriptionIntegrationService();
  return service;
}

export function resetPrescriptionIntegrationServiceForTests(): void {
  service = null;
}
