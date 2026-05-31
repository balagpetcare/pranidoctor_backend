import { z } from 'zod';

export const vetCompanyStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION',
]);

export const medicineContractTypeSchema = z.enum([
  'SPONSOR',
  'CAMPAIGN',
  'ORGANIZATION',
  'REGIONAL',
]);

export const medicineContractStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'EXPIRED',
  'CANCELLED',
]);

export const medicineFormSchema = z.enum([
  'TABLET',
  'CAPSULE',
  'INJECTION',
  'POWDER',
  'LIQUID',
  'BOLUS',
  'OINTMENT',
  'SPRAY',
  'OTHER',
]);

export const bdFeedAvailabilitySchema = z.enum([
  'WIDELY_AVAILABLE',
  'SEASONALLY_AVAILABLE',
  'REGIONAL_LIMITED',
  'IMPORT_DEPENDENT',
  'RARELY_AVAILABLE',
]);

export const livestockSpeciesSchema = z.enum([
  'CATTLE',
  'BUFFALO',
  'GOAT',
  'SHEEP',
  'POULTRY_BROILER',
  'POULTRY_LAYER',
  'DUCK',
  'FISH',
  'HORSE',
  'PIG',
]);

export const createCompanySchema = z.object({
  companyCode: z.string().min(2).max(32),
  nameBn: z.string().min(1),
  nameEn: z.string().min(1),
  shortNameEn: z.string().max(64).optional(),
  licenseNumber: z.string().max(64).optional(),
  status: vetCompanyStatusSchema.optional().default('ACTIVE'),
  contactEmail: z.string().email().max(256).optional(),
  contactPhone: z.string().max(32).optional(),
  websiteUrl: z.string().url().max(512).optional(),
  headOfficeAddress: z.string().optional(),
  regionCoverageJson: z.unknown().optional(),
  logoUrl: z.string().url().max(512).optional(),
  sortOrder: z.number().int().optional().default(0),
});

export const updateCompanySchema = z.object({
  nameBn: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  shortNameEn: z.string().max(64).nullish(),
  licenseNumber: z.string().max(64).nullish(),
  status: vetCompanyStatusSchema.optional(),
  contactEmail: z.string().email().max(256).nullish(),
  contactPhone: z.string().max(32).nullish(),
  websiteUrl: z.string().url().max(512).nullish(),
  headOfficeAddress: z.string().nullish(),
  regionCoverageJson: z.unknown().nullish(),
  logoUrl: z.string().url().max(512).nullish(),
  sortOrder: z.number().int().optional(),
});

export const createGenericSchema = z.object({
  versionId: z.string(),
  genericCode: z.string().min(2).max(64),
  genericNameEn: z.string().min(1),
  genericNameBn: z.string().min(1),
  drugClass: z.string().max(128).optional(),
  antimicrobialClass: z.string().max(64).optional(),
  therapeuticCategory: z.string().max(128).optional(),
  species: z.array(livestockSpeciesSchema).optional(),
  indicationsJson: z.unknown().optional(),
  contraindicationsJson: z.unknown().optional(),
  prescriptionRequired: z.boolean().optional().default(true),
  bannedSubstance: z.boolean().optional().default(false),
  controlledSubstance: z.boolean().optional().default(false),
  defaultWithdrawalMeatDays: z.number().int().min(0).optional(),
  defaultWithdrawalMilkDays: z.number().int().min(0).optional(),
  knowledgeEntryId: z.string().optional(),
  sourceAttributionsJson: z.unknown().optional(),
});

export const updateGenericSchema = z.object({
  genericNameEn: z.string().min(1).optional(),
  genericNameBn: z.string().min(1).optional(),
  drugClass: z.string().max(128).nullish(),
  antimicrobialClass: z.string().max(64).nullish(),
  therapeuticCategory: z.string().max(128).nullish(),
  species: z.array(livestockSpeciesSchema).optional(),
  indicationsJson: z.unknown().nullish(),
  contraindicationsJson: z.unknown().nullish(),
  prescriptionRequired: z.boolean().optional(),
  bannedSubstance: z.boolean().optional(),
  controlledSubstance: z.boolean().optional(),
  defaultWithdrawalMeatDays: z.number().int().min(0).nullish(),
  defaultWithdrawalMilkDays: z.number().int().min(0).nullish(),
  knowledgeEntryId: z.string().nullish(),
  sourceAttributionsJson: z.unknown().nullish(),
  isActive: z.boolean().optional(),
});

export const createBrandSchema = z.object({
  brandCode: z.string().min(2).max(64),
  brandNameEn: z.string().min(1),
  brandNameBn: z.string().min(1),
  genericId: z.string(),
  companyId: z.string(),
  strengthValue: z.number().min(0).optional(),
  strengthUnit: z.string().max(32).optional(),
  form: medicineFormSchema.optional().default('OTHER'),
  packSizeValue: z.number().min(0).optional(),
  packSizeUnit: z.string().max(32).optional(),
  mrpBdt: z.number().min(0).optional(),
  wholesaleBdt: z.number().min(0).optional(),
  bdAvailability: bdFeedAvailabilitySchema.optional().default('WIDELY_AVAILABLE'),
  regionAvailabilityJson: z.unknown().optional(),
  registrationNumber: z.string().max(64).optional(),
  registrationExpiry: z.coerce.date().optional(),
  sortOrder: z.number().int().optional().default(0),
});

export const updateBrandSchema = z.object({
  brandNameEn: z.string().min(1).optional(),
  brandNameBn: z.string().min(1).optional(),
  genericId: z.string().optional(),
  companyId: z.string().optional(),
  strengthValue: z.number().min(0).nullish(),
  strengthUnit: z.string().max(32).nullish(),
  form: medicineFormSchema.optional(),
  packSizeValue: z.number().min(0).nullish(),
  packSizeUnit: z.string().max(32).nullish(),
  mrpBdt: z.number().min(0).nullish(),
  wholesaleBdt: z.number().min(0).nullish(),
  bdAvailability: bdFeedAvailabilitySchema.optional(),
  regionAvailabilityJson: z.unknown().nullish(),
  registrationNumber: z.string().max(64).nullish(),
  registrationExpiry: z.coerce.date().nullish(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const createContractSchema = z.object({
  contractCode: z.string().min(2).max(64),
  contractType: medicineContractTypeSchema,
  sponsorCompanyId: z.string().optional(),
  organizationId: z.string().max(64).optional(),
  campaignId: z.string().max(64).optional(),
  regionScope: z.array(z.string()).optional().default([]),
  titleEn: z.string().min(1),
  titleBn: z.string().optional(),
  description: z.string().optional(),
  priorityScore: z.number().int().min(0).max(1000).optional().default(100),
  sponsorWeight: z.number().min(0).max(10).optional().default(1.0),
  campaignWeight: z.number().min(0).max(10).optional().default(1.0),
  regionWeight: z.number().min(0).max(10).optional().default(1.0),
  organizationWeight: z.number().min(0).max(10).optional().default(1.0),
  effectiveFrom: z.coerce.date(),
  effectiveUntil: z.coerce.date().optional(),
  rulesJson: z.unknown().optional(),
  exclusionsJson: z.unknown().optional(),
  budgetBdt: z.number().min(0).optional(),
});

export const updateContractSchema = z.object({
  contractType: medicineContractTypeSchema.optional(),
  sponsorCompanyId: z.string().nullish(),
  organizationId: z.string().max(64).nullish(),
  campaignId: z.string().max(64).nullish(),
  regionScope: z.array(z.string()).optional(),
  titleEn: z.string().min(1).optional(),
  titleBn: z.string().nullish(),
  description: z.string().nullish(),
  priorityScore: z.number().int().min(0).max(1000).optional(),
  sponsorWeight: z.number().min(0).max(10).optional(),
  campaignWeight: z.number().min(0).max(10).optional(),
  regionWeight: z.number().min(0).max(10).optional(),
  organizationWeight: z.number().min(0).max(10).optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().nullish(),
  rulesJson: z.unknown().nullish(),
  exclusionsJson: z.unknown().nullish(),
  budgetBdt: z.number().min(0).nullish(),
});

export const addContractBrandSchema = z.object({
  brandId: z.string(),
  boostScore: z.number().min(0).max(100).optional().default(0),
  exclusiveInContract: z.boolean().optional().default(false),
});

export const listCompaniesQuerySchema = z.object({
  status: vetCompanyStatusSchema.optional(),
  isVerified: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const listGenericsQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  species: livestockSpeciesSchema.optional(),
  drugClass: z.string().optional(),
  therapeuticCategory: z.string().optional(),
  search: z.string().optional(),
  bannedSubstance: z.coerce.boolean().optional(),
  controlledSubstance: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const listBrandsQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  genericId: z.string().optional(),
  companyId: z.string().optional(),
  form: medicineFormSchema.optional(),
  bdAvailability: bdFeedAvailabilitySchema.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const listContractsQuerySchema = z.object({
  status: medicineContractStatusSchema.optional(),
  contractType: medicineContractTypeSchema.optional(),
  sponsorCompanyId: z.string().optional(),
  organizationId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateGenericInput = z.infer<typeof createGenericSchema>;
export type UpdateGenericInput = z.infer<typeof updateGenericSchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type AddContractBrandInput = z.infer<typeof addContractBrandSchema>;
