import type {
  Prisma,
  MedicineContract,
  MedicineContractType,
  MedicineContractStatus,
  MedicineContractBrand,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type {
  MedicineContractView,
  ContractBrandAssociation,
  CreateMedicineContractInput,
  UpdateMedicineContractInput,
} from '../medicine.types.js';
import { CONTRACT_AUDIT_EVENT_TYPES } from '../medicine.constants.js';

type ContractWithRelations = MedicineContract & {
  sponsorCompany: { nameEn: string } | null;
  _count: { contractBrands: number };
};

type ContractBrandWithRelations = MedicineContractBrand & {
  brand: { brandCode: string; brandNameEn: string };
};

function toContractView(row: ContractWithRelations): MedicineContractView {
  return {
    id: row.id,
    contractCode: row.contractCode,
    contractType: row.contractType,
    status: row.status,
    sponsorCompanyId: row.sponsorCompanyId,
    sponsorCompanyName: row.sponsorCompany?.nameEn ?? null,
    organizationId: row.organizationId,
    campaignId: row.campaignId,
    regionScope: row.regionScope,
    titleEn: row.titleEn,
    titleBn: row.titleBn,
    description: row.description,
    priorityScore: row.priorityScore,
    sponsorWeight: row.sponsorWeight.toString(),
    campaignWeight: row.campaignWeight.toString(),
    regionWeight: row.regionWeight.toString(),
    organizationWeight: row.organizationWeight.toString(),
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveUntil: row.effectiveUntil?.toISOString() ?? null,
    rulesJson: row.rulesJson,
    exclusionsJson: row.exclusionsJson,
    budgetBdt: row.budgetBdt?.toString() ?? null,
    spentBdt: row.spentBdt.toString(),
    brandCount: row._count.contractBrands,
    createdById: row.createdById,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toContractBrandView(row: ContractBrandWithRelations): ContractBrandAssociation {
  return {
    id: row.id,
    contractId: row.contractId,
    brandId: row.brandId,
    brandCode: row.brand.brandCode,
    brandNameEn: row.brand.brandNameEn,
    boostScore: row.boostScore.toString(),
    exclusiveInContract: row.exclusiveInContract,
    createdAt: row.createdAt.toISOString(),
  };
}

const CONTRACT_INCLUDE = {
  sponsorCompany: { select: { nameEn: true } },
  _count: { select: { contractBrands: true } },
} as const;

export class ContractService {
  readonly name = 'ContractService';

  async list(params?: {
    status?: MedicineContractStatus;
    contractType?: MedicineContractType;
    sponsorCompanyId?: string;
    organizationId?: string;
    search?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MedicineContractView[]; total: number }> {
    const prisma = getPrisma();
    const where: Prisma.MedicineContractWhereInput = {};

    if (params?.status) where.status = params.status;
    if (params?.contractType) where.contractType = params.contractType;
    if (params?.sponsorCompanyId) where.sponsorCompanyId = params.sponsorCompanyId;
    if (params?.organizationId) where.organizationId = params.organizationId;
    if (params?.activeOnly) {
      where.status = 'ACTIVE';
      where.effectiveFrom = { lte: new Date() };
      where.OR = [
        { effectiveUntil: null },
        { effectiveUntil: { gte: new Date() } },
      ];
    }
    if (params?.search) {
      where.OR = [
        { titleEn: { contains: params.search, mode: 'insensitive' } },
        { titleBn: { contains: params.search, mode: 'insensitive' } },
        { contractCode: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.medicineContract.findMany({
        where,
        include: CONTRACT_INCLUDE,
        orderBy: [{ priorityScore: 'desc' }, { effectiveFrom: 'desc' }],
        take: params?.limit ?? 100,
        skip: params?.offset ?? 0,
      }),
      prisma.medicineContract.count({ where }),
    ]);

    return { items: rows.map(toContractView), total };
  }

  async getById(id: string): Promise<MedicineContractView> {
    const prisma = getPrisma();
    const row = await prisma.medicineContract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });
    if (!row) throw new Error(`Contract not found: ${id}`);
    return toContractView(row);
  }

  async getByCode(contractCode: string): Promise<MedicineContractView> {
    const prisma = getPrisma();
    const row = await prisma.medicineContract.findUnique({
      where: { contractCode },
      include: CONTRACT_INCLUDE,
    });
    if (!row) throw new Error(`Contract not found: ${contractCode}`);
    return toContractView(row);
  }

  async create(input: CreateMedicineContractInput, actorId?: string): Promise<MedicineContractView> {
    const prisma = getPrisma();

    const existing = await prisma.medicineContract.findUnique({
      where: { contractCode: input.contractCode },
    });
    if (existing) {
      throw new Error(`Contract code already exists: ${input.contractCode}`);
    }

    const row = await prisma.medicineContract.create({
      data: {
        contractCode: input.contractCode,
        contractType: input.contractType,
        status: 'DRAFT',
        sponsorCompanyId: input.sponsorCompanyId ?? null,
        organizationId: input.organizationId ?? null,
        campaignId: input.campaignId ?? null,
        regionScope: input.regionScope ?? [],
        titleEn: input.titleEn,
        titleBn: input.titleBn ?? null,
        description: input.description ?? null,
        priorityScore: input.priorityScore ?? 100,
        sponsorWeight: input.sponsorWeight ?? 1.0,
        campaignWeight: input.campaignWeight ?? 1.0,
        regionWeight: input.regionWeight ?? 1.0,
        organizationWeight: input.organizationWeight ?? 1.0,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil ?? null,
        rulesJson: input.rulesJson ? toInputJson(input.rulesJson) : null,
        exclusionsJson: input.exclusionsJson ? toInputJson(input.exclusionsJson) : null,
        budgetBdt: input.budgetBdt ?? null,
        createdById: actorId ?? null,
      },
      include: CONTRACT_INCLUDE,
    });

    await this.createAuditEvent(row.id, CONTRACT_AUDIT_EVENT_TYPES.CREATED, actorId, null, row);

    return toContractView(row);
  }

  async update(id: string, input: UpdateMedicineContractInput, actorId?: string): Promise<MedicineContractView> {
    const prisma = getPrisma();
    const previous = await this.getById(id);

    const data: Prisma.MedicineContractUncheckedUpdateInput = {};
    if (input.contractType !== undefined) data.contractType = input.contractType;
    if (input.sponsorCompanyId !== undefined) data.sponsorCompanyId = input.sponsorCompanyId ?? null;
    if (input.organizationId !== undefined) data.organizationId = input.organizationId ?? null;
    if (input.campaignId !== undefined) data.campaignId = input.campaignId ?? null;
    if (input.regionScope !== undefined) data.regionScope = input.regionScope;
    if (input.titleEn !== undefined) data.titleEn = input.titleEn;
    if (input.titleBn !== undefined) data.titleBn = input.titleBn ?? null;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.priorityScore !== undefined) data.priorityScore = input.priorityScore;
    if (input.sponsorWeight !== undefined) data.sponsorWeight = input.sponsorWeight;
    if (input.campaignWeight !== undefined) data.campaignWeight = input.campaignWeight;
    if (input.regionWeight !== undefined) data.regionWeight = input.regionWeight;
    if (input.organizationWeight !== undefined) data.organizationWeight = input.organizationWeight;
    if (input.effectiveFrom !== undefined) data.effectiveFrom = input.effectiveFrom;
    if (input.effectiveUntil !== undefined) data.effectiveUntil = input.effectiveUntil ?? null;
    if (input.rulesJson !== undefined) data.rulesJson = input.rulesJson ? toInputJson(input.rulesJson) : null;
    if (input.exclusionsJson !== undefined) data.exclusionsJson = input.exclusionsJson ? toInputJson(input.exclusionsJson) : null;
    if (input.budgetBdt !== undefined) data.budgetBdt = input.budgetBdt ?? null;

    const row = await prisma.medicineContract.update({
      where: { id },
      data,
      include: CONTRACT_INCLUDE,
    });

    await this.createAuditEvent(id, CONTRACT_AUDIT_EVENT_TYPES.UPDATED, actorId, previous, row);

    return toContractView(row);
  }

  async setStatus(id: string, status: MedicineContractStatus, actorId?: string): Promise<MedicineContractView> {
    const prisma = getPrisma();
    const previous = await this.getById(id);

    const eventType = {
      ACTIVE: CONTRACT_AUDIT_EVENT_TYPES.ACTIVATED,
      PAUSED: CONTRACT_AUDIT_EVENT_TYPES.PAUSED,
      EXPIRED: CONTRACT_AUDIT_EVENT_TYPES.EXPIRED,
      CANCELLED: CONTRACT_AUDIT_EVENT_TYPES.CANCELLED,
      DRAFT: CONTRACT_AUDIT_EVENT_TYPES.STATUS_CHANGED,
    }[status];

    const row = await prisma.medicineContract.update({
      where: { id },
      data: { status },
      include: CONTRACT_INCLUDE,
    });

    await this.createAuditEvent(id, eventType, actorId, previous, row);

    return toContractView(row);
  }

  async activate(id: string, actorId?: string): Promise<MedicineContractView> {
    return this.setStatus(id, 'ACTIVE', actorId);
  }

  async pause(id: string, actorId?: string): Promise<MedicineContractView> {
    return this.setStatus(id, 'PAUSED', actorId);
  }

  async approve(id: string, actorId: string): Promise<MedicineContractView> {
    const prisma = getPrisma();
    const previous = await this.getById(id);

    const row = await prisma.medicineContract.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approvedById: actorId,
        approvedAt: new Date(),
      },
      include: CONTRACT_INCLUDE,
    });

    await this.createAuditEvent(id, CONTRACT_AUDIT_EVENT_TYPES.APPROVED, actorId, previous, row);

    return toContractView(row);
  }

  async addBrand(
    contractId: string,
    brandId: string,
    options?: { boostScore?: number; exclusiveInContract?: boolean },
    actorId?: string,
  ): Promise<ContractBrandAssociation> {
    const prisma = getPrisma();

    const row = await prisma.medicineContractBrand.upsert({
      where: {
        contractId_brandId: { contractId, brandId },
      },
      create: {
        contractId,
        brandId,
        boostScore: options?.boostScore ?? 0,
        exclusiveInContract: options?.exclusiveInContract ?? false,
      },
      update: {
        boostScore: options?.boostScore ?? 0,
        exclusiveInContract: options?.exclusiveInContract ?? false,
      },
      include: { brand: { select: { brandCode: true, brandNameEn: true } } },
    });

    await this.createAuditEvent(
      contractId,
      CONTRACT_AUDIT_EVENT_TYPES.BRAND_ADDED,
      actorId,
      null,
      { brandId, ...options },
    );

    return toContractBrandView(row);
  }

  async removeBrand(contractId: string, brandId: string, actorId?: string): Promise<boolean> {
    const prisma = getPrisma();

    try {
      await prisma.medicineContractBrand.delete({
        where: {
          contractId_brandId: { contractId, brandId },
        },
      });

      await this.createAuditEvent(
        contractId,
        CONTRACT_AUDIT_EVENT_TYPES.BRAND_REMOVED,
        actorId,
        { brandId },
        null,
      );

      return true;
    } catch {
      return false;
    }
  }

  async getContractBrands(contractId: string): Promise<ContractBrandAssociation[]> {
    const prisma = getPrisma();
    const rows = await prisma.medicineContractBrand.findMany({
      where: { contractId },
      include: { brand: { select: { brandCode: true, brandNameEn: true } } },
    });
    return rows.map(toContractBrandView);
  }

  async getActiveContractsForBrand(brandId: string): Promise<MedicineContractView[]> {
    const prisma = getPrisma();
    const now = new Date();

    const contractBrands = await prisma.medicineContractBrand.findMany({
      where: { brandId },
      select: { contractId: true },
    });

    const contractIds = contractBrands.map((cb) => cb.contractId);

    const rows = await prisma.medicineContract.findMany({
      where: {
        id: { in: contractIds },
        status: 'ACTIVE',
        effectiveFrom: { lte: now },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: now } },
        ],
      },
      include: CONTRACT_INCLUDE,
      orderBy: { priorityScore: 'desc' },
    });

    return rows.map(toContractView);
  }

  async getActiveContractsForContext(context: {
    brandId?: string;
    companyId?: string;
    organizationId?: string;
    region?: string;
  }): Promise<MedicineContractView[]> {
    const prisma = getPrisma();
    const now = new Date();

    const baseWhere: Prisma.MedicineContractWhereInput = {
      status: 'ACTIVE',
      effectiveFrom: { lte: now },
      OR: [
        { effectiveUntil: null },
        { effectiveUntil: { gte: now } },
      ],
    };

    const conditions: Prisma.MedicineContractWhereInput[] = [];

    if (context.brandId) {
      const contractBrands = await prisma.medicineContractBrand.findMany({
        where: { brandId: context.brandId },
        select: { contractId: true },
      });
      if (contractBrands.length > 0) {
        conditions.push({ id: { in: contractBrands.map((cb) => cb.contractId) } });
      }
    }

    if (context.companyId) {
      conditions.push({ sponsorCompanyId: context.companyId });
    }

    if (context.organizationId) {
      conditions.push({
        contractType: 'ORGANIZATION',
        organizationId: context.organizationId,
      });
    }

    if (context.region) {
      conditions.push({
        contractType: 'REGIONAL',
        regionScope: { has: context.region },
      });
    }

    if (conditions.length === 0) return [];

    const rows = await prisma.medicineContract.findMany({
      where: {
        ...baseWhere,
        OR: conditions,
      },
      include: CONTRACT_INCLUDE,
      orderBy: { priorityScore: 'desc' },
    });

    return rows.map(toContractView);
  }

  private async createAuditEvent(
    contractId: string,
    eventType: string,
    actorId?: string | null,
    previousState?: unknown,
    newState?: unknown,
    reason?: string,
  ): Promise<void> {
    const prisma = getPrisma();
    await prisma.medicineContractAudit.create({
      data: {
        contractId,
        eventType,
        actorId: actorId ?? null,
        previousStateJson: previousState ? toInputJson(previousState) : null,
        newStateJson: newState ? toInputJson(newState) : null,
        reason: reason ?? null,
      },
    });
  }
}

let service: ContractService | null = null;

export function getContractService(): ContractService {
  if (!service) service = new ContractService();
  return service;
}

export function resetContractServiceForTests(): void {
  service = null;
}
