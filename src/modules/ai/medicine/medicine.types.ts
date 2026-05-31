import type {
  LivestockSpecies,
  VetCompanyStatus,
  MedicineContractType,
  MedicineContractStatus,
  MedicineForm,
  BdFeedAvailability,
  RecommendationReasonCode,
} from '../../../generated/prisma/index.js';

export type VetCompanyView = {
  id: string;
  companyCode: string;
  nameBn: string;
  nameEn: string;
  shortNameEn: string | null;
  licenseNumber: string | null;
  status: VetCompanyStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  headOfficeAddress: string | null;
  regionCoverageJson: unknown;
  logoUrl: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  brandCount: number;
  contractCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MedicineGenericView = {
  id: string;
  versionId: string;
  genericCode: string;
  genericNameEn: string;
  genericNameBn: string;
  drugClass: string | null;
  antimicrobialClass: string | null;
  therapeuticCategory: string | null;
  species: LivestockSpecies[];
  indicationsJson: unknown;
  contraindicationsJson: unknown;
  prescriptionRequired: boolean;
  bannedSubstance: boolean;
  controlledSubstance: boolean;
  defaultWithdrawalMeatDays: number | null;
  defaultWithdrawalMilkDays: number | null;
  knowledgeEntryId: string | null;
  isActive: boolean;
  brandCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MedicineBrandView = {
  id: string;
  brandCode: string;
  brandNameEn: string;
  brandNameBn: string;
  genericId: string;
  genericCode: string;
  genericNameEn: string;
  companyId: string;
  companyCode: string;
  companyNameEn: string;
  strengthValue: string | null;
  strengthUnit: string | null;
  form: MedicineForm;
  packSizeValue: string | null;
  packSizeUnit: string | null;
  mrpBdt: string | null;
  wholesaleBdt: string | null;
  bdAvailability: BdFeedAvailability;
  regionAvailabilityJson: unknown;
  registrationNumber: string | null;
  registrationExpiry: string | null;
  isActive: boolean;
  discontinuedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MedicineContractView = {
  id: string;
  contractCode: string;
  contractType: MedicineContractType;
  status: MedicineContractStatus;
  sponsorCompanyId: string | null;
  sponsorCompanyName: string | null;
  organizationId: string | null;
  campaignId: string | null;
  regionScope: string[];
  titleEn: string;
  titleBn: string | null;
  description: string | null;
  priorityScore: number;
  sponsorWeight: string;
  campaignWeight: string;
  regionWeight: string;
  organizationWeight: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  rulesJson: unknown;
  exclusionsJson: unknown;
  budgetBdt: string | null;
  spentBdt: string;
  brandCount: number;
  createdById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractBrandAssociation = {
  id: string;
  contractId: string;
  brandId: string;
  brandCode: string;
  brandNameEn: string;
  boostScore: string;
  exclusiveInContract: boolean;
  createdAt: string;
};

export type RankedBrand = {
  brandId: string;
  brandCode: string;
  brandNameEn: string;
  brandNameBn: string;
  companyId: string;
  companyNameEn: string;
  genericId: string;
  genericNameEn: string;
  totalScore: number;
  baseScore: number;
  contractBoost: number;
  sponsorBoost: number;
  campaignBoost: number;
  regionBoost: number;
  organizationBoost: number;
  availabilityBonus: number;
  pricePenalty: number;
  mrpBdt: string | null;
  form: MedicineForm;
  strengthValue: string | null;
  strengthUnit: string | null;
  reasonCodes: RecommendationReasonCode[];
  contractFactors: ContractFactor[];
  sponsorFactors: SponsorFactor[];
};

export type ContractFactor = {
  contractId: string;
  contractCode: string;
  contractType: MedicineContractType;
  weight: number;
  boostScore: number;
};

export type SponsorFactor = {
  companyId: string;
  companyNameEn: string;
  sponsorWeight: number;
  contribution: number;
};

export type RecommendationResult = {
  genericId: string;
  genericCode: string;
  genericNameEn: string;
  query: string;
  species: LivestockSpecies | null;
  region: string | null;
  rankedBrands: RankedBrand[];
  totalBrands: number;
  confidence: number;
  explainability: RecommendationExplainability;
};

export type RecommendationExplainability = {
  genericFirstApplied: boolean;
  activeContractsCount: number;
  sponsorInfluencePresent: boolean;
  regionMatchApplied: boolean;
  organizationMatchApplied: boolean;
  filters: string[];
  rankingFactors: string[];
};

export type ConflictResolutionResult = {
  winningRuleId: string | null;
  winningRuleType: string;
  resolutionReason: string;
  auditTrail: ConflictAuditEntry[];
  overriddenRules: string[];
};

export type ConflictAuditEntry = {
  ruleId: string;
  ruleType: string;
  priority: number;
  wasOverridden: boolean;
  reason: string;
};

export type CreateVetCompanyInput = {
  companyCode: string;
  nameBn: string;
  nameEn: string;
  shortNameEn?: string;
  licenseNumber?: string;
  status?: VetCompanyStatus;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  headOfficeAddress?: string;
  regionCoverageJson?: unknown;
  logoUrl?: string;
  sortOrder?: number;
};

export type UpdateVetCompanyInput = Partial<Omit<CreateVetCompanyInput, 'companyCode'>>;

export type CreateMedicineGenericInput = {
  versionId: string;
  genericCode: string;
  genericNameEn: string;
  genericNameBn: string;
  drugClass?: string;
  antimicrobialClass?: string;
  therapeuticCategory?: string;
  species?: LivestockSpecies[];
  indicationsJson?: unknown;
  contraindicationsJson?: unknown;
  prescriptionRequired?: boolean;
  bannedSubstance?: boolean;
  controlledSubstance?: boolean;
  defaultWithdrawalMeatDays?: number;
  defaultWithdrawalMilkDays?: number;
  knowledgeEntryId?: string;
  sourceAttributionsJson?: unknown;
};

export type UpdateMedicineGenericInput = Partial<Omit<CreateMedicineGenericInput, 'genericCode' | 'versionId'>>;

export type CreateMedicineBrandInput = {
  brandCode: string;
  brandNameEn: string;
  brandNameBn: string;
  genericId: string;
  companyId: string;
  strengthValue?: number;
  strengthUnit?: string;
  form?: MedicineForm;
  packSizeValue?: number;
  packSizeUnit?: string;
  mrpBdt?: number;
  wholesaleBdt?: number;
  bdAvailability?: BdFeedAvailability;
  regionAvailabilityJson?: unknown;
  registrationNumber?: string;
  registrationExpiry?: Date;
  sortOrder?: number;
};

export type UpdateMedicineBrandInput = Partial<Omit<CreateMedicineBrandInput, 'brandCode'>>;

export type CreateMedicineContractInput = {
  contractCode: string;
  contractType: MedicineContractType;
  sponsorCompanyId?: string;
  organizationId?: string;
  campaignId?: string;
  regionScope?: string[];
  titleEn: string;
  titleBn?: string;
  description?: string;
  priorityScore?: number;
  sponsorWeight?: number;
  campaignWeight?: number;
  regionWeight?: number;
  organizationWeight?: number;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  rulesJson?: unknown;
  exclusionsJson?: unknown;
  budgetBdt?: number;
};

export type UpdateMedicineContractInput = Partial<Omit<CreateMedicineContractInput, 'contractCode'>>;

export type RecommendationQuery = {
  genericCode?: string;
  genericId?: string;
  query?: string;
  species?: LivestockSpecies;
  region?: string;
  organizationId?: string;
  customerId?: string;
  userId?: string;
  sessionId?: string;
  limit?: number;
};
