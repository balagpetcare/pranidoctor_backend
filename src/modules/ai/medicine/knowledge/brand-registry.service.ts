import type {
  Prisma,
  MedicineBrand,
  MedicineForm,
  BdFeedAvailability,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type {
  MedicineBrandView,
  CreateMedicineBrandInput,
  UpdateMedicineBrandInput,
} from '../medicine.types.js';

type BrandWithRelations = MedicineBrand & {
  generic: { genericCode: string; genericNameEn: string };
  company: { companyCode: string; nameEn: string };
};

function toBrandView(row: BrandWithRelations): MedicineBrandView {
  return {
    id: row.id,
    brandCode: row.brandCode,
    brandNameEn: row.brandNameEn,
    brandNameBn: row.brandNameBn,
    genericId: row.genericId,
    genericCode: row.generic.genericCode,
    genericNameEn: row.generic.genericNameEn,
    companyId: row.companyId,
    companyCode: row.company.companyCode,
    companyNameEn: row.company.nameEn,
    strengthValue: row.strengthValue?.toString() ?? null,
    strengthUnit: row.strengthUnit,
    form: row.form,
    packSizeValue: row.packSizeValue?.toString() ?? null,
    packSizeUnit: row.packSizeUnit,
    mrpBdt: row.mrpBdt?.toString() ?? null,
    wholesaleBdt: row.wholesaleBdt?.toString() ?? null,
    bdAvailability: row.bdAvailability,
    regionAvailabilityJson: row.regionAvailabilityJson,
    registrationNumber: row.registrationNumber,
    registrationExpiry: row.registrationExpiry?.toISOString() ?? null,
    isActive: row.isActive,
    discontinuedAt: row.discontinuedAt?.toISOString() ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const BRAND_INCLUDE = {
  generic: { select: { genericCode: true, genericNameEn: true } },
  company: { select: { companyCode: true, nameEn: true } },
} as const;

export class BrandRegistryService {
  readonly name = 'BrandRegistryService';

  async list(params?: {
    isActive?: boolean;
    genericId?: string;
    companyId?: string;
    form?: MedicineForm;
    bdAvailability?: BdFeedAvailability;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MedicineBrandView[]; total: number }> {
    const prisma = getPrisma();
    const where: Prisma.MedicineBrandWhereInput = {};

    if (params?.isActive !== undefined) where.isActive = params.isActive;
    if (params?.genericId) where.genericId = params.genericId;
    if (params?.companyId) where.companyId = params.companyId;
    if (params?.form) where.form = params.form;
    if (params?.bdAvailability) where.bdAvailability = params.bdAvailability;
    if (params?.search) {
      where.OR = [
        { brandNameEn: { contains: params.search, mode: 'insensitive' } },
        { brandNameBn: { contains: params.search, mode: 'insensitive' } },
        { brandCode: { contains: params.search, mode: 'insensitive' } },
        { generic: { genericNameEn: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.medicineBrand.findMany({
        where,
        include: BRAND_INCLUDE,
        orderBy: [{ sortOrder: 'asc' }, { brandNameEn: 'asc' }],
        take: params?.limit ?? 100,
        skip: params?.offset ?? 0,
      }),
      prisma.medicineBrand.count({ where }),
    ]);

    return { items: rows.map(toBrandView), total };
  }

  async getById(id: string): Promise<MedicineBrandView> {
    const prisma = getPrisma();
    const row = await prisma.medicineBrand.findUnique({
      where: { id },
      include: BRAND_INCLUDE,
    });
    if (!row) throw new Error(`MedicineBrand not found: ${id}`);
    return toBrandView(row);
  }

  async getByCode(brandCode: string): Promise<MedicineBrandView> {
    const prisma = getPrisma();
    const row = await prisma.medicineBrand.findUnique({
      where: { brandCode },
      include: BRAND_INCLUDE,
    });
    if (!row) throw new Error(`MedicineBrand not found: ${brandCode}`);
    return toBrandView(row);
  }

  async findByCode(brandCode: string): Promise<MedicineBrandView | null> {
    const prisma = getPrisma();
    const row = await prisma.medicineBrand.findUnique({
      where: { brandCode },
      include: BRAND_INCLUDE,
    });
    return row ? toBrandView(row) : null;
  }

  async create(input: CreateMedicineBrandInput): Promise<MedicineBrandView> {
    const prisma = getPrisma();

    const existing = await prisma.medicineBrand.findUnique({
      where: { brandCode: input.brandCode },
    });
    if (existing) {
      throw new Error(`Brand code already exists: ${input.brandCode}`);
    }

    const generic = await prisma.medicineGeneric.findUnique({
      where: { id: input.genericId },
    });
    if (!generic) {
      throw new Error(`Generic not found: ${input.genericId}`);
    }

    const company = await prisma.vetCompany.findUnique({
      where: { id: input.companyId },
    });
    if (!company) {
      throw new Error(`Company not found: ${input.companyId}`);
    }

    const row = await prisma.medicineBrand.create({
      data: {
        brandCode: input.brandCode,
        brandNameEn: input.brandNameEn,
        brandNameBn: input.brandNameBn,
        genericId: input.genericId,
        companyId: input.companyId,
        strengthValue: input.strengthValue ?? null,
        strengthUnit: input.strengthUnit ?? null,
        form: input.form ?? 'OTHER',
        packSizeValue: input.packSizeValue ?? null,
        packSizeUnit: input.packSizeUnit ?? null,
        mrpBdt: input.mrpBdt ?? null,
        wholesaleBdt: input.wholesaleBdt ?? null,
        bdAvailability: input.bdAvailability ?? 'WIDELY_AVAILABLE',
        regionAvailabilityJson: input.regionAvailabilityJson ? toInputJson(input.regionAvailabilityJson) : null,
        registrationNumber: input.registrationNumber ?? null,
        registrationExpiry: input.registrationExpiry ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      include: BRAND_INCLUDE,
    });

    return toBrandView(row);
  }

  async update(id: string, input: UpdateMedicineBrandInput): Promise<MedicineBrandView> {
    const prisma = getPrisma();
    await this.getById(id);

    const data: Prisma.MedicineBrandUncheckedUpdateInput = {};
    if (input.brandNameEn !== undefined) data.brandNameEn = input.brandNameEn;
    if (input.brandNameBn !== undefined) data.brandNameBn = input.brandNameBn;
    if (input.genericId !== undefined) {
      const generic = await prisma.medicineGeneric.findUnique({
        where: { id: input.genericId },
      });
      if (!generic) throw new Error(`Generic not found: ${input.genericId}`);
      data.genericId = input.genericId;
    }
    if (input.companyId !== undefined) {
      const company = await prisma.vetCompany.findUnique({
        where: { id: input.companyId },
      });
      if (!company) throw new Error(`Company not found: ${input.companyId}`);
      data.companyId = input.companyId;
    }
    if (input.strengthValue !== undefined) data.strengthValue = input.strengthValue ?? null;
    if (input.strengthUnit !== undefined) data.strengthUnit = input.strengthUnit ?? null;
    if (input.form !== undefined) data.form = input.form;
    if (input.packSizeValue !== undefined) data.packSizeValue = input.packSizeValue ?? null;
    if (input.packSizeUnit !== undefined) data.packSizeUnit = input.packSizeUnit ?? null;
    if (input.mrpBdt !== undefined) data.mrpBdt = input.mrpBdt ?? null;
    if (input.wholesaleBdt !== undefined) data.wholesaleBdt = input.wholesaleBdt ?? null;
    if (input.bdAvailability !== undefined) data.bdAvailability = input.bdAvailability;
    if (input.regionAvailabilityJson !== undefined) {
      data.regionAvailabilityJson = input.regionAvailabilityJson ? toInputJson(input.regionAvailabilityJson) : null;
    }
    if (input.registrationNumber !== undefined) data.registrationNumber = input.registrationNumber ?? null;
    if (input.registrationExpiry !== undefined) data.registrationExpiry = input.registrationExpiry ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const row = await prisma.medicineBrand.update({
      where: { id },
      data,
      include: BRAND_INCLUDE,
    });

    return toBrandView(row);
  }

  async setActive(id: string, isActive: boolean): Promise<MedicineBrandView> {
    const prisma = getPrisma();
    await this.getById(id);

    const row = await prisma.medicineBrand.update({
      where: { id },
      data: {
        isActive,
        discontinuedAt: isActive ? null : new Date(),
      },
      include: BRAND_INCLUDE,
    });

    return toBrandView(row);
  }

  async discontinue(id: string): Promise<MedicineBrandView> {
    return this.setActive(id, false);
  }

  async getBrandsForGeneric(genericId: string, options?: {
    isActive?: boolean;
    limit?: number;
  }): Promise<MedicineBrandView[]> {
    const result = await this.list({
      genericId,
      isActive: options?.isActive ?? true,
      limit: options?.limit ?? 100,
    });
    return result.items;
  }

  async getBrandsForCompany(companyId: string, options?: {
    isActive?: boolean;
    limit?: number;
  }): Promise<MedicineBrandView[]> {
    const result = await this.list({
      companyId,
      isActive: options?.isActive ?? true,
      limit: options?.limit ?? 100,
    });
    return result.items;
  }

  async searchByName(query: string, options?: {
    isActive?: boolean;
    limit?: number;
  }): Promise<MedicineBrandView[]> {
    const result = await this.list({
      search: query,
      isActive: options?.isActive ?? true,
      limit: options?.limit ?? 20,
    });
    return result.items;
  }

  async getActiveBrandsWithAvailability(
    genericId: string,
    minAvailability?: BdFeedAvailability,
  ): Promise<MedicineBrandView[]> {
    const prisma = getPrisma();
    const availabilityOrder: BdFeedAvailability[] = [
      'WIDELY_AVAILABLE',
      'SEASONALLY_AVAILABLE',
      'REGIONAL_LIMITED',
      'IMPORT_DEPENDENT',
      'RARELY_AVAILABLE',
    ];

    const minIndex = minAvailability ? availabilityOrder.indexOf(minAvailability) : availabilityOrder.length - 1;
    const acceptedAvailabilities = availabilityOrder.slice(0, minIndex + 1);

    const rows = await prisma.medicineBrand.findMany({
      where: {
        genericId,
        isActive: true,
        bdAvailability: { in: acceptedAvailabilities },
      },
      include: BRAND_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { brandNameEn: 'asc' }],
    });

    return rows.map(toBrandView);
  }

  async countBrandsByGeneric(): Promise<Map<string, number>> {
    const prisma = getPrisma();
    const results = await prisma.medicineBrand.groupBy({
      by: ['genericId'],
      where: { isActive: true },
      _count: { id: true },
    });

    const map = new Map<string, number>();
    for (const r of results) {
      map.set(r.genericId, r._count.id);
    }
    return map;
  }

  async countBrandsByCompany(): Promise<Map<string, number>> {
    const prisma = getPrisma();
    const results = await prisma.medicineBrand.groupBy({
      by: ['companyId'],
      where: { isActive: true },
      _count: { id: true },
    });

    const map = new Map<string, number>();
    for (const r of results) {
      map.set(r.companyId, r._count.id);
    }
    return map;
  }
}

let service: BrandRegistryService | null = null;

export function getBrandRegistryService(): BrandRegistryService {
  if (!service) service = new BrandRegistryService();
  return service;
}

export function resetBrandRegistryServiceForTests(): void {
  service = null;
}
