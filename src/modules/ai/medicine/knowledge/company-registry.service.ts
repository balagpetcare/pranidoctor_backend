import type { Prisma, VetCompany, VetCompanyStatus } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type {
  VetCompanyView,
  CreateVetCompanyInput,
  UpdateVetCompanyInput,
} from '../medicine.types.js';

function toCompanyView(
  row: VetCompany & { _count?: { brands: number; contracts: number } },
): VetCompanyView {
  return {
    id: row.id,
    companyCode: row.companyCode,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
    shortNameEn: row.shortNameEn,
    licenseNumber: row.licenseNumber,
    status: row.status,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    websiteUrl: row.websiteUrl,
    headOfficeAddress: row.headOfficeAddress,
    regionCoverageJson: row.regionCoverageJson,
    logoUrl: row.logoUrl,
    isVerified: row.isVerified,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    brandCount: row._count?.brands ?? 0,
    contractCount: row._count?.contracts ?? 0,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CompanyRegistryService {
  readonly name = 'CompanyRegistryService';

  async list(params?: {
    status?: VetCompanyStatus;
    isVerified?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: VetCompanyView[]; total: number }> {
    const prisma = getPrisma();
    const where: Prisma.VetCompanyWhereInput = {};

    if (params?.status) where.status = params.status;
    if (params?.isVerified !== undefined) where.isVerified = params.isVerified;
    if (params?.search) {
      where.OR = [
        { nameEn: { contains: params.search, mode: 'insensitive' } },
        { nameBn: { contains: params.search, mode: 'insensitive' } },
        { companyCode: { contains: params.search, mode: 'insensitive' } },
        { shortNameEn: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.vetCompany.findMany({
        where,
        include: { _count: { select: { brands: true, contracts: true } } },
        orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
        take: params?.limit ?? 100,
        skip: params?.offset ?? 0,
      }),
      prisma.vetCompany.count({ where }),
    ]);

    return { items: rows.map(toCompanyView), total };
  }

  async getById(id: string): Promise<VetCompanyView> {
    const prisma = getPrisma();
    const row = await prisma.vetCompany.findUnique({
      where: { id },
      include: { _count: { select: { brands: true, contracts: true } } },
    });
    if (!row) throw new Error(`VetCompany not found: ${id}`);
    return toCompanyView(row);
  }

  async getByCode(companyCode: string): Promise<VetCompanyView> {
    const prisma = getPrisma();
    const row = await prisma.vetCompany.findUnique({
      where: { companyCode },
      include: { _count: { select: { brands: true, contracts: true } } },
    });
    if (!row) throw new Error(`VetCompany not found: ${companyCode}`);
    return toCompanyView(row);
  }

  async create(input: CreateVetCompanyInput): Promise<VetCompanyView> {
    const prisma = getPrisma();

    const existing = await prisma.vetCompany.findUnique({
      where: { companyCode: input.companyCode },
    });
    if (existing) {
      throw new Error(`Company code already exists: ${input.companyCode}`);
    }

    const row = await prisma.vetCompany.create({
      data: {
        companyCode: input.companyCode,
        nameBn: input.nameBn,
        nameEn: input.nameEn,
        shortNameEn: input.shortNameEn ?? null,
        licenseNumber: input.licenseNumber ?? null,
        status: input.status ?? 'ACTIVE',
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        websiteUrl: input.websiteUrl ?? null,
        headOfficeAddress: input.headOfficeAddress ?? null,
        regionCoverageJson: input.regionCoverageJson ? toInputJson(input.regionCoverageJson) : null,
        logoUrl: input.logoUrl ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      include: { _count: { select: { brands: true, contracts: true } } },
    });

    return toCompanyView(row);
  }

  async update(id: string, input: UpdateVetCompanyInput): Promise<VetCompanyView> {
    const prisma = getPrisma();
    await this.getById(id);

    const data: Prisma.VetCompanyUncheckedUpdateInput = {};
    if (input.nameBn !== undefined) data.nameBn = input.nameBn;
    if (input.nameEn !== undefined) data.nameEn = input.nameEn;
    if (input.shortNameEn !== undefined) data.shortNameEn = input.shortNameEn ?? null;
    if (input.licenseNumber !== undefined) data.licenseNumber = input.licenseNumber ?? null;
    if (input.status !== undefined) data.status = input.status;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail ?? null;
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone ?? null;
    if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl ?? null;
    if (input.headOfficeAddress !== undefined) data.headOfficeAddress = input.headOfficeAddress ?? null;
    if (input.regionCoverageJson !== undefined) {
      data.regionCoverageJson = input.regionCoverageJson ? toInputJson(input.regionCoverageJson) : null;
    }
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const row = await prisma.vetCompany.update({
      where: { id },
      data,
      include: { _count: { select: { brands: true, contracts: true } } },
    });

    return toCompanyView(row);
  }

  async verify(id: string, verifiedById: string): Promise<VetCompanyView> {
    const prisma = getPrisma();
    await this.getById(id);

    const row = await prisma.vetCompany.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedById,
      },
      include: { _count: { select: { brands: true, contracts: true } } },
    });

    return toCompanyView(row);
  }

  async unverify(id: string): Promise<VetCompanyView> {
    const prisma = getPrisma();
    await this.getById(id);

    const row = await prisma.vetCompany.update({
      where: { id },
      data: {
        isVerified: false,
        verifiedAt: null,
        verifiedById: null,
      },
      include: { _count: { select: { brands: true, contracts: true } } },
    });

    return toCompanyView(row);
  }

  async setStatus(id: string, status: VetCompanyStatus): Promise<VetCompanyView> {
    return this.update(id, { status });
  }

  async getActiveCompanies(): Promise<VetCompanyView[]> {
    const result = await this.list({ status: 'ACTIVE', limit: 1000 });
    return result.items;
  }

  async getVerifiedCompanies(): Promise<VetCompanyView[]> {
    const result = await this.list({ status: 'ACTIVE', isVerified: true, limit: 1000 });
    return result.items;
  }

  async searchByName(query: string): Promise<VetCompanyView[]> {
    const result = await this.list({ search: query, limit: 20 });
    return result.items;
  }
}

let service: CompanyRegistryService | null = null;

export function getCompanyRegistryService(): CompanyRegistryService {
  if (!service) service = new CompanyRegistryService();
  return service;
}

export function resetCompanyRegistryServiceForTests(): void {
  service = null;
}
