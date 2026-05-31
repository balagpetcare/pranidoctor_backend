import { getPrisma } from '../../../../shared/database/prisma.js';
import { getContractService } from './contract.service.js';
import type { MedicineContractView, ContractFactor, SponsorFactor } from '../medicine.types.js';

export type ContractEvaluationContext = {
  brandId: string;
  companyId: string;
  genericId?: string;
  organizationId?: string;
  region?: string;
  customerId?: string;
};

export type ContractEvaluationResult = {
  brandId: string;
  contractFactors: ContractFactor[];
  sponsorFactors: SponsorFactor[];
  totalContractBoost: number;
  totalSponsorBoost: number;
  activeContracts: MedicineContractView[];
};

export class ContractEvaluationEngine {
  readonly name = 'ContractEvaluationEngine';

  private contractService = getContractService();

  async evaluateForBrand(context: ContractEvaluationContext): Promise<ContractEvaluationResult> {
    const activeContracts = await this.contractService.getActiveContractsForContext({
      brandId: context.brandId,
      companyId: context.companyId,
      organizationId: context.organizationId,
      region: context.region,
    });

    const contractFactors: ContractFactor[] = [];
    const sponsorFactors: SponsorFactor[] = [];
    let totalContractBoost = 0;
    let totalSponsorBoost = 0;

    const prisma = getPrisma();

    for (const contract of activeContracts) {
      const contractBrand = await prisma.medicineContractBrand.findUnique({
        where: {
          contractId_brandId: {
            contractId: contract.id,
            brandId: context.brandId,
          },
        },
      });

      let boostScore = 0;
      let weight = 1.0;

      if (contractBrand) {
        boostScore = Number(contractBrand.boostScore);
      }

      switch (contract.contractType) {
        case 'SPONSOR':
          if (contract.sponsorCompanyId === context.companyId) {
            weight = Number(contract.sponsorWeight);
            sponsorFactors.push({
              companyId: contract.sponsorCompanyId,
              companyNameEn: contract.sponsorCompanyName ?? 'Unknown',
              sponsorWeight: weight,
              contribution: boostScore * weight,
            });
            totalSponsorBoost += boostScore * weight;
          }
          break;

        case 'CAMPAIGN':
          weight = Number(contract.campaignWeight);
          break;

        case 'ORGANIZATION':
          if (contract.organizationId === context.organizationId) {
            weight = Number(contract.organizationWeight);
          }
          break;

        case 'REGIONAL':
          if (context.region && contract.regionScope.includes(context.region)) {
            weight = Number(contract.regionWeight);
          }
          break;
      }

      if (contractBrand || contract.sponsorCompanyId === context.companyId) {
        contractFactors.push({
          contractId: contract.id,
          contractCode: contract.contractCode,
          contractType: contract.contractType,
          weight,
          boostScore,
        });
        totalContractBoost += boostScore * weight;
      }
    }

    return {
      brandId: context.brandId,
      contractFactors,
      sponsorFactors,
      totalContractBoost,
      totalSponsorBoost,
      activeContracts,
    };
  }

  async evaluateForMultipleBrands(
    brands: Array<{ brandId: string; companyId: string }>,
    commonContext: {
      genericId?: string;
      organizationId?: string;
      region?: string;
      customerId?: string;
    },
  ): Promise<Map<string, ContractEvaluationResult>> {
    const results = new Map<string, ContractEvaluationResult>();

    for (const brand of brands) {
      const result = await this.evaluateForBrand({
        brandId: brand.brandId,
        companyId: brand.companyId,
        ...commonContext,
      });
      results.set(brand.brandId, result);
    }

    return results;
  }

  async getContractImpactSummary(contractId: string): Promise<{
    contractId: string;
    totalBrands: number;
    avgBoostScore: number;
    exclusiveBrands: number;
    estimatedReach: number;
  }> {
    const prisma = getPrisma();

    const contractBrands = await prisma.medicineContractBrand.findMany({
      where: { contractId },
    });

    const totalBrands = contractBrands.length;
    const exclusiveBrands = contractBrands.filter((cb) => cb.exclusiveInContract).length;
    const avgBoostScore =
      totalBrands > 0
        ? contractBrands.reduce((sum, cb) => sum + Number(cb.boostScore), 0) / totalBrands
        : 0;

    const estimatedReach = totalBrands * 100;

    return {
      contractId,
      totalBrands,
      avgBoostScore: Math.round(avgBoostScore * 100) / 100,
      exclusiveBrands,
      estimatedReach,
    };
  }

  async findConflictingContracts(brandId: string): Promise<MedicineContractView[][]> {
    const activeContracts = await this.contractService.getActiveContractsForBrand(brandId);

    const conflicts: MedicineContractView[][] = [];

    for (let i = 0; i < activeContracts.length; i++) {
      for (let j = i + 1; j < activeContracts.length; j++) {
        const c1 = activeContracts[i];
        const c2 = activeContracts[j];

        if (c1.contractType === c2.contractType) {
          conflicts.push([c1, c2]);
        }
      }
    }

    return conflicts;
  }
}

let engine: ContractEvaluationEngine | null = null;

export function getContractEvaluationEngine(): ContractEvaluationEngine {
  if (!engine) engine = new ContractEvaluationEngine();
  return engine;
}

export function resetContractEvaluationEngineForTests(): void {
  engine = null;
}
