import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getTherapeuticClassificationService } from '../knowledge/therapeutic-classification.service.js';
import { getGenericRegistryService } from '../knowledge/generic-registry.service.js';
import { getBrandRegistryService } from '../knowledge/brand-registry.service.js';

export type SafetyContext = {
  species: LivestockSpecies;
  age?: number; // in months
  weight?: number; // in kg
  sex?: 'MALE' | 'FEMALE' | 'CASTRATED';
  isPregnant?: boolean;
  isLactating?: boolean;
  gestationStage?: number; // in weeks
  lactationStage?: number; // in weeks
  previousMedications?: string[]; // generic codes
  currentMedications?: string[]; // generic codes
  medicalConditions?: string[];
  allergies?: string[];
  productionPurpose?: 'MEAT' | 'MILK' | 'EGG' | 'BREEDING' | 'WORK';
  slaughterDate?: Date;
  lastMilkingDate?: Date;
};

export type SafetyViolation = {
  violationId: string;
  severity: 'BLOCKING' | 'WARNING' | 'CAUTION' | 'INFO';
  category: 'SPECIES' | 'AGE' | 'PREGNANCY' | 'LACTATION' | 'INTERACTION' | 'CONTRAINDICATION' | 'WITHDRAWAL' | 'ALLERGY' | 'DOSAGE';
  message: string;
  details: string;
  recommendation: string;
  regulatoryBasis?: string;
  alternatives?: string[];
};

export type SafetyAssessmentResult = {
  isApproved: boolean;
  overallRiskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: SafetyViolation[];
  requiredActions: Array<{
    action: 'VET_CONSULTATION' | 'DOSE_ADJUSTMENT' | 'MONITORING' | 'CONTRAINDICATION_CHECK' | 'WITHDRAWAL_PERIOD';
    description: string;
    urgency: 'IMMEDIATE' | 'URGENT' | 'ROUTINE';
  }>;
  withdrawalRequirements?: {
    meat?: { days: number; notes?: string };
    milk?: { days: number; notes?: string };
    egg?: { days: number; notes?: string };
  };
  monitoringRequirements: string[];
  emergencyWarnings: string[];
};

export class ComprehensiveSafetyEngine {
  readonly name = 'ComprehensiveSafetyEngine';

  private therapeuticClassification = getTherapeuticClassificationService();
  private genericRegistry = getGenericRegistryService();
  private brandRegistry = getBrandRegistryService();

  /**
   * Perform comprehensive safety assessment for a medicine in given context
   */
  async assessSafety(
    genericCode: string,
    context: SafetyContext,
    proposedDose?: { amount: number; unit: string; route: string; frequency: number }
  ): Promise<SafetyAssessmentResult> {
    const violations: SafetyViolation[] = [];
    const requiredActions: SafetyAssessmentResult['requiredActions'] = [];
    const monitoringRequirements: string[] = [];
    const emergencyWarnings: string[] = [];

    // Get medicine information
    const generic = await this.genericRegistry.getByCode(genericCode);
    if (!generic) {
      return this.createBlockedResult('MEDICINE_NOT_FOUND', 'Medicine not found in registry');
    }

    // 1. Species Compatibility Check
    await this.checkSpeciesCompatibility(generic, context, violations);

    // 2. Age Restrictions Check
    await this.checkAgeRestrictions(generic, context, violations);

    // 3. Pregnancy Safety Check
    await this.checkPregnancySafety(generic, context, violations, emergencyWarnings);

    // 4. Lactation Safety Check
    await this.checkLactationSafety(generic, context, violations);

    // 5. Drug Interaction Check
    await this.checkDrugInteractions(generic, context, violations, emergencyWarnings);

    // 6. Contraindication Check
    await this.checkContraindications(generic, context, violations);

    // 7. Allergy Check
    await this.checkAllergies(generic, context, violations, emergencyWarnings);

    // 8. Dosage Safety Check
    if (proposedDose) {
      await this.checkDosageSafety(generic, context, proposedDose, violations);
    }

    // 9. Withdrawal Period Requirements
    const withdrawalRequirements = await this.calculateWithdrawalRequirements(generic, context);

    // 10. Production Purpose Check
    await this.checkProductionPurpose(generic, context, violations);

    // Determine required actions
    this.determineRequiredActions(violations, requiredActions, monitoringRequirements);

    // Calculate overall risk level
    const overallRiskLevel = this.calculateOverallRiskLevel(violations);

    // Determine if approved
    const isApproved = !violations.some(v => v.severity === 'BLOCKING');

    return {
      isApproved,
      overallRiskLevel,
      violations,
      requiredActions,
      withdrawalRequirements,
      monitoringRequirements,
      emergencyWarnings,
    };
  }

  /**
   * Check multiple medicines for interactions and cumulative risks
   */
  async assessMultipleMedicines(
    medicineCombination: Array<{ genericCode: string; dose?: any }>,
    context: SafetyContext
  ): Promise<SafetyAssessmentResult & {
    interactionMatrix: Array<{
      medicine1: string;
      medicine2: string;
      interactionType: 'SYNERGISTIC' | 'ANTAGONISTIC' | 'TOXIC' | 'UNKNOWN';
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      mechanism: string;
      clinicalEffect: string;
      management: string;
    }>;
    cumulativeEffects: string[];
  }> {
    // First, assess each medicine individually
    const individualAssessments = await Promise.all(
      medicineCombination.map(med => this.assessSafety(med.genericCode, context, med.dose))
    );

    // Combine all violations
    const allViolations = individualAssessments.flatMap(a => a.violations);

    // Check for drug-drug interactions
    const interactionMatrix = await this.checkMultipleDrugInteractions(
      medicineCombination.map(m => m.genericCode)
    );

    // Add interaction violations
    for (const interaction of interactionMatrix) {
      if (interaction.severity === 'CRITICAL' || interaction.severity === 'HIGH') {
        allViolations.push({
          violationId: `INTERACTION_${interaction.medicine1}_${interaction.medicine2}`,
          severity: interaction.severity === 'CRITICAL' ? 'BLOCKING' : 'WARNING',
          category: 'INTERACTION',
          message: `${interaction.interactionType} interaction between ${interaction.medicine1} and ${interaction.medicine2}`,
          details: interaction.clinicalEffect,
          recommendation: interaction.management,
        });
      }
    }

    // Check for cumulative effects
    const cumulativeEffects = await this.assessCumulativeEffects(
      medicineCombination.map(m => m.genericCode)
    );

    // Calculate combined assessment
    const overallRiskLevel = this.calculateOverallRiskLevel(allViolations);
    const isApproved = !allViolations.some(v => v.severity === 'BLOCKING');

    const requiredActions: SafetyAssessmentResult['requiredActions'] = [];
    const monitoringRequirements: string[] = [];
    this.determineRequiredActions(allViolations, requiredActions, monitoringRequirements);

    return {
      isApproved,
      overallRiskLevel,
      violations: allViolations,
      requiredActions,
      monitoringRequirements,
      emergencyWarnings: individualAssessments.flatMap(a => a.emergencyWarnings),
      interactionMatrix,
      cumulativeEffects,
    };
  }

  private async checkSpeciesCompatibility(
    generic: any,
    context: SafetyContext,
    violations: SafetyViolation[]
  ): Promise<void> {
    if (generic.species && generic.species.length > 0) {
      if (!generic.species.includes(context.species)) {
        violations.push({
          violationId: 'SPECIES_INCOMPATIBLE',
          severity: 'BLOCKING',
          category: 'SPECIES',
          message: `${generic.genericNameEn} is not approved for ${context.species}`,
          details: `Approved species: ${generic.species.join(', ')}`,
          recommendation: 'Select an alternative medicine approved for this species',
          alternatives: await this.findSpeciesAlternatives(generic.id, context.species),
        });
      }
    }
  }

  private async checkAgeRestrictions(
    generic: any,
    context: SafetyContext,
    violations: SafetyViolation[]
  ): Promise<void> {
    if (context.age !== undefined) {
      // Common age restrictions (would be in database in production)
      const ageRestrictions = {
        'FLUOROQUINOLONE': { minMonths: 2, reason: 'Cartilage development issues' },
        'TETRACYCLINE': { minMonths: 1, reason: 'Tooth discoloration and bone growth' },
        'CHLORAMPHENICOL': { minMonths: 1, reason: 'Bone marrow suppression risk' },
      };

      const restriction = ageRestrictions[generic.drugClass as keyof typeof ageRestrictions];
      if (restriction && context.age < restriction.minMonths) {
        violations.push({
          violationId: 'AGE_RESTRICTION',
          severity: 'BLOCKING',
          category: 'AGE',
          message: `${generic.genericNameEn} not recommended for animals under ${restriction.minMonths} months`,
          details: restriction.reason,
          recommendation: `Wait until animal is at least ${restriction.minMonths} months old or use age-appropriate alternative`,
        });
      }
    }
  }

  private async checkPregnancySafety(
    generic: any,
    context: SafetyContext,
    violations: SafetyViolation[],
    emergencyWarnings: string[]
  ): Promise<void> {
    if (context.isPregnant) {
      const classification = await this.therapeuticClassification.getTherapeuticClassification(generic.genericCode);
      
      // Check for pregnancy contraindications
      const pregnancyContraindication = classification.contraindications.find(
        c => c.contraindicationType === 'PREGNANCY'
      );

      if (pregnancyContraindication) {
        const severity = pregnancyContraindication.severity === 'ABSOLUTE' ? 'BLOCKING' : 'WARNING';
        violations.push({
          violationId: 'PREGNANCY_CONTRAINDICATION',
          severity,
          category: 'PREGNANCY',
          message: `${generic.genericNameEn} contraindicated in pregnancy`,
          details: pregnancyContraindication.reason,
          recommendation: pregnancyContraindication.alternatives?.join(', ') || 'Consult veterinarian for pregnancy-safe alternatives',
        });

        if (severity === 'BLOCKING') {
          emergencyWarnings.push(`CRITICAL: ${generic.genericNameEn} can cause fetal harm - DO NOT USE in pregnant animals`);
        }
      }

      // Gestational stage-specific warnings
      if (context.gestationStage !== undefined) {
        if (context.gestationStage < 12 && generic.drugClass === 'BENZIMIDAZOLE') {
          violations.push({
            violationId: 'EARLY_PREGNANCY_RISK',
            severity: 'BLOCKING',
            category: 'PREGNANCY',
            message: 'Benzimidazoles contraindicated in first trimester',
            details: 'High risk of embryonic/fetal malformations',
            recommendation: 'Delay treatment until after first trimester or use alternative',
          });
        }
      }
    }
  }

  private async checkLactationSafety(
    generic: any,
    context: SafetyContext,
    violations: SafetyViolation[]
  ): Promise<void> {
    if (context.isLactating) {
      // Check withdrawal periods for milk
      const withdrawalInfo = await this.therapeuticClassification.getWithdrawalInformation(
        generic.genericCode,
        context.species,
        'MILK'
      );

      if (withdrawalInfo.withdrawalDays > 0) {
        violations.push({
          violationId: 'MILK_WITHDRAWAL_REQUIRED',
          severity: 'WARNING',
          category: 'LACTATION',
          message: `Milk withdrawal required: ${withdrawalInfo.withdrawalDays} days`,
          details: `Based on ${withdrawalInfo.regulatorySource}`,
          recommendation: 'Inform owner of milk withdrawal requirements',
        });
      }

      // Special lactation contraindications
      if (generic.drugClass === 'CHLORAMPHENICOL') {
        violations.push({
          violationId: 'LACTATION_CONTRAINDICATED',
          severity: 'BLOCKING',
          category: 'LACTATION',
          message: 'Chloramphenicol contraindicated in lactating animals',
          details: 'Risk of human exposure through milk consumption',
          recommendation: 'Use alternative antibiotic or cease lactation during treatment',
        });
      }
    }
  }

  private async checkDrugInteractions(
    generic: any,
    context: SafetyContext,
    violations: SafetyViolation[],
    emergencyWarnings: string[]
  ): Promise<void> {
    if (context.currentMedications && context.currentMedications.length > 0) {
      const classification = await this.therapeuticClassification.getTherapeuticClassification(generic.genericCode);

      for (const currentMed of context.currentMedications) {
        const currentClassification = await this.therapeuticClassification.getTherapeuticClassification(currentMed);
        
        // Check for known interactions
        const interaction = classification.interactions.find(
          i => i.drugClassB === currentClassification.drugClass?.drugClassCode
        );

        if (interaction) {
          const severity = this.mapInteractionSeverityToViolation(interaction.interactionType);
          violations.push({
            violationId: `INTERACTION_${generic.genericCode}_${currentMed}`,
            severity,
            category: 'INTERACTION',
            message: `${interaction.interactionType} interaction with ${currentMed}`,
            details: interaction.clinicalEffect,
            recommendation: interaction.management,
          });

          if (interaction.interactionType === 'CONTRAINDICATED') {
            emergencyWarnings.push(`CRITICAL: Do not combine ${generic.genericNameEn} with ${currentMed} - contraindicated interaction`);
          }
        }
      }
    }
  }

  private async checkContraindications(
    generic: any,
    context: SafetyContext,
    violations: SafetyViolation[]
  ): Promise<void> {
    const classification = await this.therapeuticClassification.getTherapeuticClassification(generic.genericCode);

    for (const contraindication of classification.contraindications) {
      // Check condition-based contraindications
      if (contraindication.contraindicationType === 'CONDITION') {
        if (context.medicalConditions?.includes(contraindication.contraindicatedWith)) {
          violations.push({
            violationId: `CONDITION_CONTRAINDICATION_${contraindication.ruleId}`,
            severity: contraindication.severity === 'ABSOLUTE' ? 'BLOCKING' : 'WARNING',
            category: 'CONTRAINDICATION',
            message: `Contraindicated with ${contraindication.contraindicatedWith}`,
            details: contraindication.reason,
            recommendation: contraindication.alternatives?.join(', ') || 'Consult veterinarian',
          });
        }
      }
    }
  }

  private async checkAllergies(
    generic: any,
    context: SafetyContext,
    violations: SafetyViolation[],
    emergencyWarnings: string[]
  ): Promise<void> {
    if (context.allergies && context.allergies.length > 0) {
      // Check for direct allergies
      if (context.allergies.includes(generic.genericCode) || 
          context.allergies.includes(generic.drugClass)) {
        violations.push({
          violationId: 'KNOWN_ALLERGY',
          severity: 'BLOCKING',
          category: 'ALLERGY',
          message: `Known allergy to ${generic.genericNameEn} or ${generic.drugClass}`,
          details: 'Animal has documented allergic reaction',
          recommendation: 'Use alternative from different drug class',
        });

        emergencyWarnings.push(`CRITICAL: Animal has known allergy to ${generic.genericNameEn} - DO NOT USE`);
      }

      // Cross-allergenicity (e.g., penicillin cross-allergy)
      if (generic.drugClass === 'CEPHALOSPORIN' && context.allergies.includes('PENICILLIN')) {
        violations.push({
          violationId: 'CROSS_ALLERGY_RISK',
          severity: 'WARNING',
          category: 'ALLERGY',
          message: 'Potential cross-allergenicity with penicillin',
          details: 'Cephalosporins may cross-react with penicillin allergies',
          recommendation: 'Use with extreme caution, have emergency treatment ready',
        });
      }
    }
  }

  private async checkDosageSafety(
    generic: any,
    context: SafetyContext,
    proposedDose: { amount: number; unit: string; route: string; frequency: number },
    violations: SafetyViolation[]
  ): Promise<void> {
    // This would check against species-specific dosing guidelines
    // For now, implementing basic overdose protection

    const maxDailyDose = this.getMaxDailyDose(generic.drugClass, context.species, context.weight || 50);
    const proposedDailyDose = proposedDose.amount * proposedDose.frequency;

    if (proposedDailyDose > maxDailyDose) {
      violations.push({
        violationId: 'OVERDOSE_RISK',
        severity: 'BLOCKING',
        category: 'DOSAGE',
        message: `Proposed dose exceeds maximum safe limit`,
        details: `Proposed: ${proposedDailyDose}${proposedDose.unit}/day, Max: ${maxDailyDose}${proposedDose.unit}/day`,
        recommendation: `Reduce dose to maximum of ${maxDailyDose}${proposedDose.unit}/day`,
      });
    }
  }

  private async checkProductionPurpose(
    generic: any,
    context: SafetyContext,
    violations: SafetyViolation[]
  ): Promise<void> {
    if (context.productionPurpose === 'MEAT' && context.slaughterDate) {
      const daysToSlaughter = Math.ceil((context.slaughterDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      const withdrawalInfo = await this.therapeuticClassification.getWithdrawalInformation(
        generic.genericCode,
        context.species,
        'MEAT'
      );

      if (daysToSlaughter < withdrawalInfo.withdrawalDays) {
        violations.push({
          violationId: 'INSUFFICIENT_WITHDRAWAL_TIME',
          severity: 'BLOCKING',
          category: 'WITHDRAWAL',
          message: `Insufficient time for meat withdrawal`,
          details: `Requires ${withdrawalInfo.withdrawalDays} days, only ${daysToSlaughter} days available`,
          recommendation: 'Delay slaughter or use alternative medicine with shorter withdrawal',
        });
      }
    }
  }

  private async calculateWithdrawalRequirements(generic: any, context: SafetyContext) {
    const requirements: any = {};

    if (context.productionPurpose === 'MEAT' || context.productionPurpose === 'MILK') {
      const meatWithdrawal = await this.therapeuticClassification.getWithdrawalInformation(
        generic.genericCode,
        context.species,
        'MEAT'
      );
      requirements.meat = { days: meatWithdrawal.withdrawalDays, notes: meatWithdrawal.notes };
    }

    if (context.isLactating || context.productionPurpose === 'MILK') {
      const milkWithdrawal = await this.therapeuticClassification.getWithdrawalInformation(
        generic.genericCode,
        context.species,
        'MILK'
      );
      requirements.milk = { days: milkWithdrawal.withdrawalDays, notes: milkWithdrawal.notes };
    }

    if (context.species === 'POULTRY' || context.species === 'DUCK') {
      const eggWithdrawal = await this.therapeuticClassification.getWithdrawalInformation(
        generic.genericCode,
        context.species,
        'EGG'
      );
      requirements.egg = { days: eggWithdrawal.withdrawalDays, notes: eggWithdrawal.notes };
    }

    return requirements;
  }

  // Helper methods
  private createBlockedResult(reason: string, message: string): SafetyAssessmentResult {
    return {
      isApproved: false,
      overallRiskLevel: 'CRITICAL',
      violations: [{
        violationId: reason,
        severity: 'BLOCKING',
        category: 'CONTRAINDICATION',
        message,
        details: '',
        recommendation: 'Cannot proceed with this medicine',
      }],
      requiredActions: [{
        action: 'VET_CONSULTATION',
        description: 'Veterinary consultation required',
        urgency: 'IMMEDIATE',
      }],
      monitoringRequirements: [],
      emergencyWarnings: [message],
    };
  }

  private calculateOverallRiskLevel(violations: SafetyViolation[]): SafetyAssessmentResult['overallRiskLevel'] {
    if (violations.some(v => v.severity === 'BLOCKING')) return 'CRITICAL';
    if (violations.some(v => v.severity === 'WARNING')) return 'HIGH';
    if (violations.some(v => v.severity === 'CAUTION')) return 'MEDIUM';
    if (violations.some(v => v.severity === 'INFO')) return 'LOW';
    return 'NONE';
  }

  private determineRequiredActions(
    violations: SafetyViolation[],
    requiredActions: SafetyAssessmentResult['requiredActions'],
    monitoringRequirements: string[]
  ): void {
    const hasBlocking = violations.some(v => v.severity === 'BLOCKING');
    const hasWarning = violations.some(v => v.severity === 'WARNING');

    if (hasBlocking) {
      requiredActions.push({
        action: 'VET_CONSULTATION',
        description: 'Veterinary consultation required due to safety contraindications',
        urgency: 'IMMEDIATE',
      });
    } else if (hasWarning) {
      requiredActions.push({
        action: 'VET_CONSULTATION',
        description: 'Veterinary consultation recommended due to safety warnings',
        urgency: 'URGENT',
      });
    }

    // Add specific monitoring based on violations
    for (const violation of violations) {
      if (violation.category === 'INTERACTION') {
        monitoringRequirements.push('Monitor for drug interaction symptoms');
      }
      if (violation.category === 'DOSAGE') {
        monitoringRequirements.push('Monitor for signs of overdose or toxicity');
      }
      if (violation.category === 'PREGNANCY') {
        monitoringRequirements.push('Monitor fetal development and maternal health');
      }
    }
  }

  private mapInteractionSeverityToViolation(interactionType: string): SafetyViolation['severity'] {
    switch (interactionType) {
      case 'CONTRAINDICATED': return 'BLOCKING';
      case 'MAJOR': return 'WARNING';
      case 'MODERATE': return 'CAUTION';
      default: return 'INFO';
    }
  }

  private getMaxDailyDose(drugClass: string, species: LivestockSpecies, weight: number): number {
    // Simplified dosing guidelines - in production this would be comprehensive
    const guidelines: Record<string, Record<LivestockSpecies, number>> = {
      'PENICILLIN': { CATTLE: 20, GOAT: 25, SHEEP: 25, POULTRY: 30, DUCK: 30, FISH: 10 },
      'TETRACYCLINE': { CATTLE: 15, GOAT: 20, SHEEP: 20, POULTRY: 25, DUCK: 25, FISH: 8 },
    };

    return (guidelines[drugClass]?.[species] || 10) * weight; // mg/kg/day * weight
  }

  private async findSpeciesAlternatives(genericId: string, species: LivestockSpecies): Promise<string[]> {
    // This would query for alternative medicines approved for the species
    return ['Consult veterinarian for species-appropriate alternatives'];
  }

  private async checkMultipleDrugInteractions(genericCodes: string[]) {
    // This would check all pairwise interactions
    return []; // Simplified for now
  }

  private async assessCumulativeEffects(genericCodes: string[]): Promise<string[]> {
    // This would assess cumulative toxicity, organ burden, etc.
    return []; // Simplified for now
  }
}

let engine: ComprehensiveSafetyEngine | null = null;

export function getComprehensiveSafetyEngine(): ComprehensiveSafetyEngine {
  if (!engine) engine = new ComprehensiveSafetyEngine();
  return engine;
}

export function resetComprehensiveSafetyEngineForTests(): void {
  engine = null;
}