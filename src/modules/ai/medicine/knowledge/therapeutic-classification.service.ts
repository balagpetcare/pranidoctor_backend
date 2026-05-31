import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import type { MedicineGenericView } from '../medicine.types.js';

export type TherapeuticClass = {
  classCode: string;
  classNameEn: string;
  classNameBn: string;
  description: string;
  parentClassCode?: string;
  level: number; // 1=primary, 2=secondary, 3=tertiary
  species: LivestockSpecies[];
  commonIndications: string[];
  safetyWarnings: string[];
  contraindicatedWith: string[];
};

export type DrugClass = {
  drugClassCode: string;
  drugClassName: string;
  mechanismOfAction: string;
  therapeuticClasses: string[]; // Related therapeutic class codes
  species: LivestockSpecies[];
  commonSideEffects: string[];
  monitoring: string[];
  interactions: DrugInteraction[];
};

export type DrugInteraction = {
  drugClassA: string;
  drugClassB: string;
  interactionType: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE' | 'MINOR';
  mechanism: string;
  clinicalEffect: string;
  management: string;
  severity: number; // 1-10
};

export type ContraindicationRule = {
  ruleId: string;
  genericCode?: string;
  drugClass?: string;
  therapeuticClass?: string;
  contraindicationType: 'SPECIES' | 'AGE' | 'PREGNANCY' | 'LACTATION' | 'CONDITION' | 'DRUG_INTERACTION';
  contraindicatedWith: string; // species, age range, condition, or drug
  severity: 'ABSOLUTE' | 'RELATIVE' | 'CAUTION';
  reason: string;
  alternatives?: string[];
};

export type WithdrawalRule = {
  ruleId: string;
  genericCode?: string;
  drugClass?: string;
  species: LivestockSpecies;
  withdrawalType: 'MEAT' | 'MILK' | 'EGG';
  withdrawalDays: number;
  doseDependent: boolean;
  routeDependent: boolean;
  notes?: string;
  regulatorySource: string; // BSTI, DGHS, etc.
};

// Comprehensive therapeutic classification system for Bangladesh
export const THERAPEUTIC_CLASSIFICATIONS: TherapeuticClass[] = [
  // Anti-infectives
  {
    classCode: 'J01',
    classNameEn: 'Antibacterials',
    classNameBn: 'ব্যাকটেরিয়া বিরোধী',
    description: 'Systemic antibacterial agents',
    level: 1,
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonIndications: ['bacterial infections', 'mastitis', 'pneumonia', 'diarrhea'],
    safetyWarnings: ['Monitor for resistance', 'Complete full course'],
    contraindicatedWith: ['viral infections'],
  },
  {
    classCode: 'J01A',
    classNameEn: 'Beta-lactam antibiotics',
    classNameBn: 'বেটা-ল্যাকটাম এন্টিবায়োটিক',
    description: 'Penicillins, cephalosporins, carbapenems',
    parentClassCode: 'J01',
    level: 2,
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonIndications: ['gram-positive infections', 'mastitis'],
    safetyWarnings: ['Check for allergies', 'Withdrawal periods'],
    contraindicatedWith: ['known hypersensitivity'],
  },
  {
    classCode: 'J02',
    classNameEn: 'Antifungals',
    classNameBn: 'ছত্রাক বিরোধী',
    description: 'Systemic antifungal agents',
    level: 1,
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonIndications: ['fungal infections', 'ringworm', 'candidiasis'],
    safetyWarnings: ['Monitor liver function', 'Long treatment duration'],
    contraindicatedWith: ['liver disease'],
  },

  // Antiparasitics
  {
    classCode: 'P01',
    classNameEn: 'Anthelmintics',
    classNameBn: 'কৃমিনাশক',
    description: 'Agents against helminths',
    level: 1,
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonIndications: ['roundworms', 'tapeworms', 'flukes'],
    safetyWarnings: ['Rotation required', 'Monitor for resistance'],
    contraindicatedWith: ['pregnancy (some agents)'],
  },
  {
    classCode: 'P02',
    classNameEn: 'Ectoparasiticides',
    classNameBn: 'বহিঃপরজীবী নাশক',
    description: 'Agents against external parasites',
    level: 1,
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonIndications: ['ticks', 'mites', 'lice', 'flies'],
    safetyWarnings: ['Avoid overdosing', 'Environmental contamination'],
    contraindicatedWith: ['young animals'],
  },

  // Vaccines
  {
    classCode: 'J07',
    classNameEn: 'Vaccines',
    classNameBn: 'টিকা',
    description: 'Immunological agents',
    level: 1,
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonIndications: ['prevention', 'immunization'],
    safetyWarnings: ['Cold chain required', 'Anaphylaxis risk'],
    contraindicatedWith: ['immunocompromised animals'],
  },

  // Pain and inflammation
  {
    classCode: 'M01',
    classNameEn: 'Anti-inflammatory agents',
    classNameBn: 'প্রদাহ বিরোধী',
    description: 'NSAIDs and corticosteroids',
    level: 1,
    species: ['CATTLE', 'GOAT', 'SHEEP'],
    commonIndications: ['pain', 'inflammation', 'fever'],
    safetyWarnings: ['GI ulceration risk', 'Kidney toxicity'],
    contraindicatedWith: ['renal disease', 'peptic ulcers'],
  },

  // Vitamins and minerals
  {
    classCode: 'A11',
    classNameEn: 'Vitamins',
    classNameBn: 'ভিটামিন',
    description: 'Vitamin supplements',
    level: 1,
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonIndications: ['deficiency', 'supplementation'],
    safetyWarnings: ['Fat-soluble vitamin toxicity'],
    contraindicatedWith: ['hypervitaminosis'],
  },
];

export const DRUG_CLASSIFICATIONS: DrugClass[] = [
  {
    drugClassCode: 'PENICILLIN',
    drugClassName: 'Penicillins',
    mechanismOfAction: 'Inhibits bacterial cell wall synthesis',
    therapeuticClasses: ['J01A'],
    species: ['CATTLE', 'GOAT', 'SHEEP'],
    commonSideEffects: ['allergic reactions', 'GI upset'],
    monitoring: ['signs of allergy', 'treatment response'],
    interactions: [],
  },
  {
    drugClassCode: 'CEPHALOSPORIN',
    drugClassName: 'Cephalosporins',
    mechanismOfAction: 'Inhibits bacterial cell wall synthesis',
    therapeuticClasses: ['J01A'],
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonSideEffects: ['GI upset', 'superinfection'],
    monitoring: ['kidney function', 'treatment response'],
    interactions: [],
  },
  {
    drugClassCode: 'MACROLIDE',
    drugClassName: 'Macrolides',
    mechanismOfAction: 'Inhibits protein synthesis',
    therapeuticClasses: ['J01'],
    species: ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY'],
    commonSideEffects: ['GI upset', 'arrhythmias'],
    monitoring: ['heart rhythm', 'liver function'],
    interactions: [],
  },
  {
    drugClassCode: 'BENZIMIDAZOLE',
    drugClassName: 'Benzimidazoles',
    mechanismOfAction: 'Disrupts microtubule function in parasites',
    therapeuticClasses: ['P01'],
    species: ['CATTLE', 'GOAT', 'SHEEP'],
    commonSideEffects: ['teratogenicity', 'bone marrow suppression'],
    monitoring: ['pregnancy status', 'blood counts'],
    interactions: [],
  },
];

export class TherapeuticClassificationService {
  readonly name = 'TherapeuticClassificationService';

  /**
   * Get therapeutic classification for a generic medicine
   */
  async getTherapeuticClassification(genericCode: string): Promise<{
    therapeuticClass?: TherapeuticClass;
    drugClass?: DrugClass;
    contraindications: ContraindicationRule[];
    withdrawalRules: WithdrawalRule[];
    interactions: DrugInteraction[];
  }> {
    const prisma = getPrisma();

    // Get generic info
    const generic = await prisma.medicineGeneric.findUnique({
      where: { genericCode },
    });

    if (!generic) {
      return { contraindications: [], withdrawalRules: [], interactions: [] };
    }

    // Find matching therapeutic class
    const therapeuticClass = THERAPEUTIC_CLASSIFICATIONS.find(
      tc => tc.classCode === generic.therapeuticCategory
    );

    // Find matching drug class
    const drugClass = DRUG_CLASSIFICATIONS.find(
      dc => dc.drugClassCode === generic.drugClass
    );

    // Get contraindications
    const contraindications = await this.getContraindications(genericCode, generic.drugClass, generic.therapeuticCategory);

    // Get withdrawal rules
    const withdrawalRules = await this.getWithdrawalRules(genericCode, generic.drugClass);

    // Get drug interactions
    const interactions = await this.getDrugInteractions(generic.drugClass);

    return {
      therapeuticClass,
      drugClass,
      contraindications,
      withdrawalRules,
      interactions,
    };
  }

  /**
   * Validate medicine safety for given context
   */
  async validateMedicineSafety(
    genericCode: string,
    context: {
      species?: LivestockSpecies;
      age?: number; // in months
      isPregnant?: boolean;
      isLactating?: boolean;
      concurrentMedications?: string[];
      medicalConditions?: string[];
    }
  ): Promise<{
    isApproved: boolean;
    warnings: Array<{
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      type: string;
      message: string;
      recommendation?: string;
    }>;
    contraindications: Array<{
      type: string;
      reason: string;
      severity: 'ABSOLUTE' | 'RELATIVE' | 'CAUTION';
    }>;
    requiredMonitoring: string[];
  }> {
    const classification = await this.getTherapeuticClassification(genericCode);
    const warnings: any[] = [];
    const contraindications: any[] = [];
    const requiredMonitoring: string[] = [];
    let isApproved = true;

    // Check species suitability
    if (context.species && classification.therapeuticClass) {
      if (!classification.therapeuticClass.species.includes(context.species)) {
        warnings.push({
          severity: 'HIGH',
          type: 'SPECIES_MISMATCH',
          message: `Not approved for ${context.species}`,
          recommendation: 'Consult veterinarian for species-appropriate alternatives',
        });
        isApproved = false;
      }
    }

    // Check age restrictions
    if (context.age !== undefined) {
      if (context.age < 2 && classification.drugClass?.drugClassCode === 'FLUOROQUINOLONE') {
        contraindications.push({
          type: 'AGE_RESTRICTION',
          reason: 'Fluoroquinolones contraindicated in young animals',
          severity: 'ABSOLUTE',
        });
        isApproved = false;
      }
    }

    // Check pregnancy safety
    if (context.isPregnant && classification.drugClass?.drugClassCode === 'BENZIMIDAZOLE') {
      contraindications.push({
        type: 'PREGNANCY',
        reason: 'Teratogenic effects reported with benzimidazoles',
        severity: 'ABSOLUTE',
      });
      isApproved = false;
    }

    // Check drug interactions
    if (context.concurrentMedications?.length) {
      for (const interaction of classification.interactions) {
        if (context.concurrentMedications.some(med => med.includes(interaction.drugClassB))) {
          if (interaction.interactionType === 'CONTRAINDICATED') {
            contraindications.push({
              type: 'DRUG_INTERACTION',
              reason: interaction.clinicalEffect,
              severity: 'ABSOLUTE',
            });
            isApproved = false;
          } else {
            warnings.push({
              severity: interaction.interactionType === 'MAJOR' ? 'HIGH' : 'MEDIUM',
              type: 'DRUG_INTERACTION',
              message: interaction.clinicalEffect,
              recommendation: interaction.management,
            });
          }
        }
      }
    }

    // Add monitoring requirements
    if (classification.drugClass?.monitoring) {
      requiredMonitoring.push(...classification.drugClass.monitoring);
    }

    return {
      isApproved,
      warnings,
      contraindications,
      requiredMonitoring,
    };
  }

  /**
   * Get withdrawal period information
   */
  async getWithdrawalInformation(
    genericCode: string,
    species: LivestockSpecies,
    productType: 'MEAT' | 'MILK' | 'EGG'
  ): Promise<{
    withdrawalDays: number;
    isRegulated: boolean;
    regulatorySource: string;
    notes?: string;
    extendedWithdrawal?: {
      condition: string;
      additionalDays: number;
    };
  }> {
    const withdrawalRules = await this.getWithdrawalRules(genericCode, null);
    
    const applicableRule = withdrawalRules.find(
      rule => rule.species === species && rule.withdrawalType === productType
    );

    if (applicableRule) {
      return {
        withdrawalDays: applicableRule.withdrawalDays,
        isRegulated: true,
        regulatorySource: applicableRule.regulatorySource,
        notes: applicableRule.notes,
      };
    }

    // Default fallback for unspecified medicines
    const defaultWithdrawal = this.getDefaultWithdrawal(productType, species);
    return {
      withdrawalDays: defaultWithdrawal,
      isRegulated: false,
      regulatorySource: 'General guideline',
      notes: 'Consult veterinarian for specific withdrawal requirements',
    };
  }

  private async getContraindications(
    genericCode?: string, 
    drugClass?: string | null, 
    therapeuticClass?: string | null
  ): Promise<ContraindicationRule[]> {
    // In production, this would query a comprehensive contraindications database
    // For now, returning common contraindication patterns
    const contraindications: ContraindicationRule[] = [];

    if (drugClass === 'FLUOROQUINOLONE') {
      contraindications.push({
        ruleId: 'FQ_AGE_001',
        drugClass: 'FLUOROQUINOLONE',
        contraindicationType: 'AGE',
        contraindicatedWith: '<2 months',
        severity: 'ABSOLUTE',
        reason: 'Cartilage damage in young animals',
        alternatives: ['penicillins', 'cephalexin'],
      });
    }

    if (drugClass === 'BENZIMIDAZOLE') {
      contraindications.push({
        ruleId: 'BZ_PREG_001',
        drugClass: 'BENZIMIDAZOLE',
        contraindicationType: 'PREGNANCY',
        contraindicatedWith: 'first trimester',
        severity: 'ABSOLUTE',
        reason: 'Teratogenic effects',
        alternatives: ['levamisole', 'ivermectin'],
      });
    }

    return contraindications;
  }

  private async getWithdrawalRules(
    genericCode?: string, 
    drugClass?: string | null
  ): Promise<WithdrawalRule[]> {
    // In production, this would query regulatory databases
    const rules: WithdrawalRule[] = [];

    if (drugClass === 'PENICILLIN') {
      rules.push(
        {
          ruleId: 'PEN_MILK_001',
          drugClass: 'PENICILLIN',
          species: 'CATTLE',
          withdrawalType: 'MILK',
          withdrawalDays: 4,
          doseDependent: false,
          routeDependent: true,
          regulatorySource: 'BSTI',
          notes: 'Intramammary route - 4 days, Systemic - 2 days',
        },
        {
          ruleId: 'PEN_MEAT_001',
          drugClass: 'PENICILLIN',
          species: 'CATTLE',
          withdrawalType: 'MEAT',
          withdrawalDays: 10,
          doseDependent: true,
          routeDependent: true,
          regulatorySource: 'BSTI',
        },
      );
    }

    return rules;
  }

  private async getDrugInteractions(drugClass?: string | null): Promise<DrugInteraction[]> {
    // In production, this would query a comprehensive interaction database
    return DRUG_CLASSIFICATIONS.find(dc => dc.drugClassCode === drugClass)?.interactions || [];
  }

  private getDefaultWithdrawal(productType: 'MEAT' | 'MILK' | 'EGG', species: LivestockSpecies): number {
    // Conservative default withdrawal periods
    const defaults = {
      MEAT: { CATTLE: 28, GOAT: 21, SHEEP: 21, POULTRY: 14, DUCK: 14, FISH: 14 },
      MILK: { CATTLE: 7, GOAT: 5, SHEEP: 5 },
      EGG: { POULTRY: 7, DUCK: 7 },
    };

    return (defaults[productType] as any)[species] || 28;
  }
}

let service: TherapeuticClassificationService | null = null;

export function getTherapeuticClassificationService(): TherapeuticClassificationService {
  if (!service) service = new TherapeuticClassificationService();
  return service;
}

export function resetTherapeuticClassificationServiceForTests(): void {
  service = null;
}