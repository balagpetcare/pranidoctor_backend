import { CONFLICT_PRIORITY_ORDER } from '../medicine.constants.js';
import type {
  ConflictResolutionResult,
  ConflictAuditEntry,
  MedicineContractView,
} from '../medicine.types.js';
import { getGenericRegistryService } from '../knowledge/generic-registry.service.js';

export type ConflictRule = {
  id: string;
  type: 'REGULATORY' | 'GOVERNANCE' | 'ORGANIZATION' | 'REGIONAL' | 'CAMPAIGN' | 'SPONSOR';
  priority: number;
  description: string;
  applies: boolean;
  data?: unknown;
};

export type ConflictContext = {
  genericId: string;
  brandId?: string;
  organizationId?: string;
  region?: string;
  activeContracts: MedicineContractView[];
};

export class ConflictResolutionEngine {
  readonly name = 'ConflictResolutionEngine';

  private genericRegistry = getGenericRegistryService();

  async resolve(context: ConflictContext): Promise<ConflictResolutionResult> {
    const rules = await this.collectApplicableRules(context);
    const sortedRules = this.sortByPriority(rules);

    if (sortedRules.length === 0) {
      return {
        winningRuleId: null,
        winningRuleType: 'NONE',
        resolutionReason: 'No applicable rules found',
        auditTrail: [],
        overriddenRules: [],
      };
    }

    const winningRule = sortedRules[0];
    const overriddenRules = sortedRules.slice(1).map((r) => r.id);

    const auditTrail: ConflictAuditEntry[] = sortedRules.map((rule, index) => ({
      ruleId: rule.id,
      ruleType: rule.type,
      priority: rule.priority,
      wasOverridden: index > 0,
      reason: index === 0 ? 'Highest priority rule' : `Overridden by ${winningRule.type} rule`,
    }));

    return {
      winningRuleId: winningRule.id,
      winningRuleType: winningRule.type,
      resolutionReason: this.buildResolutionReason(winningRule),
      auditTrail,
      overriddenRules,
    };
  }

  private async collectApplicableRules(context: ConflictContext): Promise<ConflictRule[]> {
    const rules: ConflictRule[] = [];

    const regulatoryRule = await this.checkRegulatoryRules(context);
    if (regulatoryRule) rules.push(regulatoryRule);

    const governanceRule = await this.checkGovernanceRules(context);
    if (governanceRule) rules.push(governanceRule);

    for (const contract of context.activeContracts) {
      const contractRule = this.contractToRule(contract, context);
      if (contractRule.applies) {
        rules.push(contractRule);
      }
    }

    return rules;
  }

  private async checkRegulatoryRules(context: ConflictContext): Promise<ConflictRule | null> {
    try {
      const generic = await this.genericRegistry.getById(context.genericId);

      if (generic.bannedSubstance) {
        return {
          id: `regulatory:banned:${context.genericId}`,
          type: 'REGULATORY',
          priority: CONFLICT_PRIORITY_ORDER.REGULATORY,
          description: 'Banned substance - cannot be recommended',
          applies: true,
          data: { reason: 'BANNED_SUBSTANCE', genericId: context.genericId },
        };
      }

      if (generic.controlledSubstance) {
        return {
          id: `regulatory:controlled:${context.genericId}`,
          type: 'REGULATORY',
          priority: CONFLICT_PRIORITY_ORDER.REGULATORY - 100,
          description: 'Controlled substance - requires additional verification',
          applies: true,
          data: { reason: 'CONTROLLED_SUBSTANCE', genericId: context.genericId },
        };
      }
    } catch {
      // Generic not found - no regulatory rules apply
    }

    return null;
  }

  private async checkGovernanceRules(context: ConflictContext): Promise<ConflictRule | null> {
    try {
      const generic = await this.genericRegistry.getById(context.genericId);

      if (generic.prescriptionRequired) {
        return {
          id: `governance:prescription:${context.genericId}`,
          type: 'GOVERNANCE',
          priority: CONFLICT_PRIORITY_ORDER.GOVERNANCE,
          description: 'Prescription required - vet approval needed',
          applies: true,
          data: { reason: 'PRESCRIPTION_REQUIRED', genericId: context.genericId },
        };
      }
    } catch {
      // Generic not found - no governance rules apply
    }

    return null;
  }

  private contractToRule(contract: MedicineContractView, context: ConflictContext): ConflictRule {
    let applies = false;
    let priority = 0;

    switch (contract.contractType) {
      case 'ORGANIZATION':
        applies = contract.organizationId === context.organizationId;
        priority = CONFLICT_PRIORITY_ORDER.ORGANIZATION + contract.priorityScore;
        break;

      case 'REGIONAL':
        applies = context.region !== undefined && contract.regionScope.includes(context.region);
        priority = CONFLICT_PRIORITY_ORDER.REGIONAL + contract.priorityScore;
        break;

      case 'CAMPAIGN':
        applies = true;
        priority = CONFLICT_PRIORITY_ORDER.CAMPAIGN + contract.priorityScore;
        break;

      case 'SPONSOR':
        applies = true;
        priority = CONFLICT_PRIORITY_ORDER.SPONSOR + contract.priorityScore;
        break;
    }

    return {
      id: `contract:${contract.contractType.toLowerCase()}:${contract.id}`,
      type: contract.contractType,
      priority,
      description: contract.titleEn,
      applies,
      data: { contractId: contract.id, contractCode: contract.contractCode },
    };
  }

  private sortByPriority(rules: ConflictRule[]): ConflictRule[] {
    return [...rules].sort((a, b) => b.priority - a.priority);
  }

  private buildResolutionReason(rule: ConflictRule): string {
    switch (rule.type) {
      case 'REGULATORY':
        return `Regulatory rule applied: ${rule.description}`;
      case 'GOVERNANCE':
        return `Governance rule applied: ${rule.description}`;
      case 'ORGANIZATION':
        return `Organization-specific rule applied: ${rule.description}`;
      case 'REGIONAL':
        return `Regional rule applied: ${rule.description}`;
      case 'CAMPAIGN':
        return `Campaign rule applied: ${rule.description}`;
      case 'SPONSOR':
        return `Sponsor rule applied: ${rule.description}`;
      default:
        return rule.description;
    }
  }

  resolveMultipleSponsors(
    sponsorContracts: MedicineContractView[],
  ): { winner: MedicineContractView | null; reason: string } {
    if (sponsorContracts.length === 0) {
      return { winner: null, reason: 'No sponsor contracts' };
    }

    if (sponsorContracts.length === 1) {
      return { winner: sponsorContracts[0], reason: 'Single sponsor contract' };
    }

    const sorted = [...sponsorContracts].sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime();
    });

    return {
      winner: sorted[0],
      reason: `Resolved by priority score (${sorted[0].priorityScore}) and effective date`,
    };
  }

  resolveOverlappingContracts(
    contracts: MedicineContractView[],
  ): { active: MedicineContractView[]; expired: MedicineContractView[]; future: MedicineContractView[] } {
    const now = new Date();

    const active: MedicineContractView[] = [];
    const expired: MedicineContractView[] = [];
    const future: MedicineContractView[] = [];

    for (const contract of contracts) {
      const effectiveFrom = new Date(contract.effectiveFrom);
      const effectiveUntil = contract.effectiveUntil ? new Date(contract.effectiveUntil) : null;

      if (effectiveFrom > now) {
        future.push(contract);
      } else if (effectiveUntil && effectiveUntil < now) {
        expired.push(contract);
      } else {
        active.push(contract);
      }
    }

    return { active, expired, future };
  }

  checkRegionConflict(
    contracts: MedicineContractView[],
    region: string,
  ): { hasConflict: boolean; conflictingContracts: MedicineContractView[] } {
    const regionalContracts = contracts.filter(
      (c) => c.contractType === 'REGIONAL' && c.regionScope.includes(region),
    );

    return {
      hasConflict: regionalContracts.length > 1,
      conflictingContracts: regionalContracts,
    };
  }

  checkOrganizationConflict(
    contracts: MedicineContractView[],
    organizationId: string,
  ): { hasConflict: boolean; conflictingContracts: MedicineContractView[] } {
    const orgContracts = contracts.filter(
      (c) => c.contractType === 'ORGANIZATION' && c.organizationId === organizationId,
    );

    return {
      hasConflict: orgContracts.length > 1,
      conflictingContracts: orgContracts,
    };
  }
}

let engine: ConflictResolutionEngine | null = null;

export function getConflictResolutionEngine(): ConflictResolutionEngine {
  if (!engine) engine = new ConflictResolutionEngine();
  return engine;
}

export function resetConflictResolutionEngineForTests(): void {
  engine = null;
}
