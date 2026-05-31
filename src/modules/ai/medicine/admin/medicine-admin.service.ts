import type {
  VetCompanyStatus,
  MedicineContractStatus,
  MedicineContractType,
  MedicineForm,
  BdFeedAvailability,
  LivestockSpecies,
} from '../../../../generated/prisma/index.js';
import { getCompanyRegistryService } from '../knowledge/company-registry.service.js';
import { getGenericRegistryService } from '../knowledge/generic-registry.service.js';
import { getBrandRegistryService } from '../knowledge/brand-registry.service.js';
import { getMedicineKnowledgeService } from '../knowledge/medicine-knowledge.service.js';
import type {
  VetCompanyView,
  MedicineGenericView,
  MedicineBrandView,
  CreateVetCompanyInput,
  UpdateVetCompanyInput,
  CreateMedicineGenericInput,
  UpdateMedicineGenericInput,
  CreateMedicineBrandInput,
  UpdateMedicineBrandInput,
} from '../medicine.types.js';
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateGenericInput,
  UpdateGenericInput,
  CreateBrandInput,
  UpdateBrandInput,
} from './medicine-admin.schemas.js';

export class MedicineAdminService {
  readonly name = 'MedicineAdminService';

  async listCompanies(params: {
    status?: VetCompanyStatus;
    isVerified?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: VetCompanyView[]; total: number }> {
    return getCompanyRegistryService().list(params);
  }

  async getCompany(id: string): Promise<VetCompanyView> {
    return getCompanyRegistryService().getById(id);
  }

  async createCompany(input: CreateCompanyInput): Promise<VetCompanyView> {
    const createInput: CreateVetCompanyInput = {
      companyCode: input.companyCode,
      nameBn: input.nameBn,
      nameEn: input.nameEn,
      shortNameEn: input.shortNameEn,
      licenseNumber: input.licenseNumber,
      status: input.status,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      websiteUrl: input.websiteUrl,
      headOfficeAddress: input.headOfficeAddress,
      regionCoverageJson: input.regionCoverageJson,
      logoUrl: input.logoUrl,
      sortOrder: input.sortOrder,
    };
    return getCompanyRegistryService().create(createInput);
  }

  async updateCompany(id: string, input: UpdateCompanyInput): Promise<VetCompanyView> {
    const updateInput: UpdateVetCompanyInput = {};
    if (input.nameBn !== undefined) updateInput.nameBn = input.nameBn;
    if (input.nameEn !== undefined) updateInput.nameEn = input.nameEn;
    if (input.shortNameEn !== undefined) updateInput.shortNameEn = input.shortNameEn ?? undefined;
    if (input.licenseNumber !== undefined) updateInput.licenseNumber = input.licenseNumber ?? undefined;
    if (input.status !== undefined) updateInput.status = input.status;
    if (input.contactEmail !== undefined) updateInput.contactEmail = input.contactEmail ?? undefined;
    if (input.contactPhone !== undefined) updateInput.contactPhone = input.contactPhone ?? undefined;
    if (input.websiteUrl !== undefined) updateInput.websiteUrl = input.websiteUrl ?? undefined;
    if (input.headOfficeAddress !== undefined) updateInput.headOfficeAddress = input.headOfficeAddress ?? undefined;
    if (input.regionCoverageJson !== undefined) updateInput.regionCoverageJson = input.regionCoverageJson ?? undefined;
    if (input.logoUrl !== undefined) updateInput.logoUrl = input.logoUrl ?? undefined;
    if (input.sortOrder !== undefined) updateInput.sortOrder = input.sortOrder;

    return getCompanyRegistryService().update(id, updateInput);
  }

  async verifyCompany(id: string, actorId: string): Promise<VetCompanyView> {
    return getCompanyRegistryService().verify(id, actorId);
  }

  async unverifyCompany(id: string): Promise<VetCompanyView> {
    return getCompanyRegistryService().unverify(id);
  }

  async setCompanyStatus(id: string, status: VetCompanyStatus): Promise<VetCompanyView> {
    return getCompanyRegistryService().setStatus(id, status);
  }

  async listGenerics(params: {
    isActive?: boolean;
    species?: LivestockSpecies;
    drugClass?: string;
    therapeuticCategory?: string;
    search?: string;
    bannedSubstance?: boolean;
    controlledSubstance?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MedicineGenericView[]; total: number }> {
    return getGenericRegistryService().list(params);
  }

  async getGeneric(id: string): Promise<MedicineGenericView> {
    return getGenericRegistryService().getById(id);
  }

  async createGeneric(input: CreateGenericInput): Promise<MedicineGenericView> {
    const createInput: CreateMedicineGenericInput = {
      versionId: input.versionId,
      genericCode: input.genericCode,
      genericNameEn: input.genericNameEn,
      genericNameBn: input.genericNameBn,
      drugClass: input.drugClass,
      antimicrobialClass: input.antimicrobialClass,
      therapeuticCategory: input.therapeuticCategory,
      species: input.species,
      indicationsJson: input.indicationsJson,
      contraindicationsJson: input.contraindicationsJson,
      prescriptionRequired: input.prescriptionRequired,
      bannedSubstance: input.bannedSubstance,
      controlledSubstance: input.controlledSubstance,
      defaultWithdrawalMeatDays: input.defaultWithdrawalMeatDays,
      defaultWithdrawalMilkDays: input.defaultWithdrawalMilkDays,
      knowledgeEntryId: input.knowledgeEntryId,
      sourceAttributionsJson: input.sourceAttributionsJson,
    };
    return getGenericRegistryService().create(createInput);
  }

  async updateGeneric(id: string, input: UpdateGenericInput): Promise<MedicineGenericView> {
    const updateInput: UpdateMedicineGenericInput = {};
    if (input.genericNameEn !== undefined) updateInput.genericNameEn = input.genericNameEn;
    if (input.genericNameBn !== undefined) updateInput.genericNameBn = input.genericNameBn;
    if (input.drugClass !== undefined) updateInput.drugClass = input.drugClass ?? undefined;
    if (input.antimicrobialClass !== undefined) updateInput.antimicrobialClass = input.antimicrobialClass ?? undefined;
    if (input.therapeuticCategory !== undefined) updateInput.therapeuticCategory = input.therapeuticCategory ?? undefined;
    if (input.species !== undefined) updateInput.species = input.species;
    if (input.indicationsJson !== undefined) updateInput.indicationsJson = input.indicationsJson ?? undefined;
    if (input.contraindicationsJson !== undefined) updateInput.contraindicationsJson = input.contraindicationsJson ?? undefined;
    if (input.prescriptionRequired !== undefined) updateInput.prescriptionRequired = input.prescriptionRequired;
    if (input.bannedSubstance !== undefined) updateInput.bannedSubstance = input.bannedSubstance;
    if (input.controlledSubstance !== undefined) updateInput.controlledSubstance = input.controlledSubstance;
    if (input.defaultWithdrawalMeatDays !== undefined) updateInput.defaultWithdrawalMeatDays = input.defaultWithdrawalMeatDays ?? undefined;
    if (input.defaultWithdrawalMilkDays !== undefined) updateInput.defaultWithdrawalMilkDays = input.defaultWithdrawalMilkDays ?? undefined;
    if (input.knowledgeEntryId !== undefined) updateInput.knowledgeEntryId = input.knowledgeEntryId ?? undefined;
    if (input.sourceAttributionsJson !== undefined) updateInput.sourceAttributionsJson = input.sourceAttributionsJson ?? undefined;

    return getGenericRegistryService().update(id, updateInput);
  }

  async setGenericActive(id: string, isActive: boolean): Promise<MedicineGenericView> {
    return getGenericRegistryService().setActive(id, isActive);
  }

  async listBrands(params: {
    isActive?: boolean;
    genericId?: string;
    companyId?: string;
    form?: MedicineForm;
    bdAvailability?: BdFeedAvailability;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MedicineBrandView[]; total: number }> {
    return getBrandRegistryService().list(params);
  }

  async getBrand(id: string): Promise<MedicineBrandView> {
    return getBrandRegistryService().getById(id);
  }

  async createBrand(input: CreateBrandInput): Promise<MedicineBrandView> {
    const createInput: CreateMedicineBrandInput = {
      brandCode: input.brandCode,
      brandNameEn: input.brandNameEn,
      brandNameBn: input.brandNameBn,
      genericId: input.genericId,
      companyId: input.companyId,
      strengthValue: input.strengthValue,
      strengthUnit: input.strengthUnit,
      form: input.form,
      packSizeValue: input.packSizeValue,
      packSizeUnit: input.packSizeUnit,
      mrpBdt: input.mrpBdt,
      wholesaleBdt: input.wholesaleBdt,
      bdAvailability: input.bdAvailability,
      regionAvailabilityJson: input.regionAvailabilityJson,
      registrationNumber: input.registrationNumber,
      registrationExpiry: input.registrationExpiry,
      sortOrder: input.sortOrder,
    };
    return getBrandRegistryService().create(createInput);
  }

  async updateBrand(id: string, input: UpdateBrandInput): Promise<MedicineBrandView> {
    const updateInput: UpdateMedicineBrandInput = {};
    if (input.brandNameEn !== undefined) updateInput.brandNameEn = input.brandNameEn;
    if (input.brandNameBn !== undefined) updateInput.brandNameBn = input.brandNameBn;
    if (input.genericId !== undefined) updateInput.genericId = input.genericId;
    if (input.companyId !== undefined) updateInput.companyId = input.companyId;
    if (input.strengthValue !== undefined) updateInput.strengthValue = input.strengthValue ?? undefined;
    if (input.strengthUnit !== undefined) updateInput.strengthUnit = input.strengthUnit ?? undefined;
    if (input.form !== undefined) updateInput.form = input.form;
    if (input.packSizeValue !== undefined) updateInput.packSizeValue = input.packSizeValue ?? undefined;
    if (input.packSizeUnit !== undefined) updateInput.packSizeUnit = input.packSizeUnit ?? undefined;
    if (input.mrpBdt !== undefined) updateInput.mrpBdt = input.mrpBdt ?? undefined;
    if (input.wholesaleBdt !== undefined) updateInput.wholesaleBdt = input.wholesaleBdt ?? undefined;
    if (input.bdAvailability !== undefined) updateInput.bdAvailability = input.bdAvailability;
    if (input.regionAvailabilityJson !== undefined) updateInput.regionAvailabilityJson = input.regionAvailabilityJson ?? undefined;
    if (input.registrationNumber !== undefined) updateInput.registrationNumber = input.registrationNumber ?? undefined;
    if (input.registrationExpiry !== undefined) updateInput.registrationExpiry = input.registrationExpiry ?? undefined;
    if (input.sortOrder !== undefined) updateInput.sortOrder = input.sortOrder;

    return getBrandRegistryService().update(id, updateInput);
  }

  async setBrandActive(id: string, isActive: boolean): Promise<MedicineBrandView> {
    return getBrandRegistryService().setActive(id, isActive);
  }

  async discontinueBrand(id: string): Promise<MedicineBrandView> {
    return getBrandRegistryService().discontinue(id);
  }

  async getStats() {
    return getMedicineKnowledgeService().getStats();
  }

  async searchMedicines(query: string, options?: {
    species?: LivestockSpecies;
    limit?: number;
  }) {
    return getMedicineKnowledgeService().searchMedicines(query, options);
  }

  async getGenericWithBrands(genericId: string) {
    return getMedicineKnowledgeService().getGenericWithBrands(genericId);
  }

  async getCompanyWithBrands(companyId: string) {
    return getMedicineKnowledgeService().getCompanyWithBrands(companyId);
  }
}

let service: MedicineAdminService | null = null;

export function getMedicineAdminService(): MedicineAdminService {
  if (!service) service = new MedicineAdminService();
  return service;
}

export function resetMedicineAdminServiceForTests(): void {
  service = null;
}
