import type {
  Prisma,
  MedicineGeneric,
  LivestockSpecies,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type {
  MedicineGenericView,
  CreateMedicineGenericInput,
  UpdateMedicineGenericInput,
} from '../medicine.types.js';

function toGenericView(
  row: MedicineGeneric & { _count?: { brands: number } },
): MedicineGenericView {
  return {
    id: row.id,
    versionId: row.versionId,
    genericCode: row.genericCode,
    genericNameEn: row.genericNameEn,
    genericNameBn: row.genericNameBn,
    drugClass: row.drugClass,
    antimicrobialClass: row.antimicrobialClass,
    therapeuticCategory: row.therapeuticCategory,
    species: row.species,
    indicationsJson: row.indicationsJson,
    contraindicationsJson: row.contraindicationsJson,
    prescriptionRequired: row.prescriptionRequired,
    bannedSubstance: row.bannedSubstance,
    controlledSubstance: row.controlledSubstance,
    defaultWithdrawalMeatDays: row.defaultWithdrawalMeatDays,
    defaultWithdrawalMilkDays: row.defaultWithdrawalMilkDays,
    knowledgeEntryId: row.knowledgeEntryId,
    isActive: row.isActive,
    brandCount: row._count?.brands ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class GenericRegistryService {
  readonly name = 'GenericRegistryService';

  async list(params?: {
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
    const prisma = getPrisma();
    const where: Prisma.MedicineGenericWhereInput = {};

    if (params?.isActive !== undefined) where.isActive = params.isActive;
    if (params?.species) where.species = { has: params.species };
    if (params?.drugClass) where.drugClass = { contains: params.drugClass, mode: 'insensitive' };
    if (params?.therapeuticCategory) {
      where.therapeuticCategory = { contains: params.therapeuticCategory, mode: 'insensitive' };
    }
    if (params?.bannedSubstance !== undefined) where.bannedSubstance = params.bannedSubstance;
    if (params?.controlledSubstance !== undefined) where.controlledSubstance = params.controlledSubstance;
    if (params?.search) {
      where.OR = [
        { genericNameEn: { contains: params.search, mode: 'insensitive' } },
        { genericNameBn: { contains: params.search, mode: 'insensitive' } },
        { genericCode: { contains: params.search, mode: 'insensitive' } },
        { drugClass: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.medicineGeneric.findMany({
        where,
        include: { _count: { select: { brands: true } } },
        orderBy: [{ genericNameEn: 'asc' }],
        take: params?.limit ?? 100,
        skip: params?.offset ?? 0,
      }),
      prisma.medicineGeneric.count({ where }),
    ]);

    return { items: rows.map(toGenericView), total };
  }

  async getById(id: string): Promise<MedicineGenericView> {
    const prisma = getPrisma();
    const row = await prisma.medicineGeneric.findUnique({
      where: { id },
      include: { _count: { select: { brands: true } } },
    });
    if (!row) throw new Error(`MedicineGeneric not found: ${id}`);
    return toGenericView(row);
  }

  async getByCode(genericCode: string): Promise<MedicineGenericView> {
    const prisma = getPrisma();
    const row = await prisma.medicineGeneric.findUnique({
      where: { genericCode },
      include: { _count: { select: { brands: true } } },
    });
    if (!row) throw new Error(`MedicineGeneric not found: ${genericCode}`);
    return toGenericView(row);
  }

  async findByCode(genericCode: string): Promise<MedicineGenericView | null> {
    const prisma = getPrisma();
    const row = await prisma.medicineGeneric.findUnique({
      where: { genericCode },
      include: { _count: { select: { brands: true } } },
    });
    return row ? toGenericView(row) : null;
  }

  async create(input: CreateMedicineGenericInput): Promise<MedicineGenericView> {
    const prisma = getPrisma();

    const existing = await prisma.medicineGeneric.findUnique({
      where: { genericCode: input.genericCode },
    });
    if (existing) {
      throw new Error(`Generic code already exists: ${input.genericCode}`);
    }

    const row = await prisma.medicineGeneric.create({
      data: {
        versionId: input.versionId,
        genericCode: input.genericCode,
        genericNameEn: input.genericNameEn,
        genericNameBn: input.genericNameBn,
        drugClass: input.drugClass ?? null,
        antimicrobialClass: input.antimicrobialClass ?? null,
        therapeuticCategory: input.therapeuticCategory ?? null,
        species: input.species ?? [],
        indicationsJson: input.indicationsJson ? toInputJson(input.indicationsJson) : null,
        contraindicationsJson: input.contraindicationsJson ? toInputJson(input.contraindicationsJson) : null,
        prescriptionRequired: input.prescriptionRequired ?? true,
        bannedSubstance: input.bannedSubstance ?? false,
        controlledSubstance: input.controlledSubstance ?? false,
        defaultWithdrawalMeatDays: input.defaultWithdrawalMeatDays ?? null,
        defaultWithdrawalMilkDays: input.defaultWithdrawalMilkDays ?? null,
        knowledgeEntryId: input.knowledgeEntryId ?? null,
        sourceAttributionsJson: input.sourceAttributionsJson ? toInputJson(input.sourceAttributionsJson) : null,
      },
      include: { _count: { select: { brands: true } } },
    });

    return toGenericView(row);
  }

  async update(id: string, input: UpdateMedicineGenericInput): Promise<MedicineGenericView> {
    const prisma = getPrisma();
    await this.getById(id);

    const data: Prisma.MedicineGenericUncheckedUpdateInput = {};
    if (input.genericNameEn !== undefined) data.genericNameEn = input.genericNameEn;
    if (input.genericNameBn !== undefined) data.genericNameBn = input.genericNameBn;
    if (input.drugClass !== undefined) data.drugClass = input.drugClass ?? null;
    if (input.antimicrobialClass !== undefined) data.antimicrobialClass = input.antimicrobialClass ?? null;
    if (input.therapeuticCategory !== undefined) data.therapeuticCategory = input.therapeuticCategory ?? null;
    if (input.species !== undefined) data.species = input.species;
    if (input.indicationsJson !== undefined) {
      data.indicationsJson = input.indicationsJson ? toInputJson(input.indicationsJson) : null;
    }
    if (input.contraindicationsJson !== undefined) {
      data.contraindicationsJson = input.contraindicationsJson ? toInputJson(input.contraindicationsJson) : null;
    }
    if (input.prescriptionRequired !== undefined) data.prescriptionRequired = input.prescriptionRequired;
    if (input.bannedSubstance !== undefined) data.bannedSubstance = input.bannedSubstance;
    if (input.controlledSubstance !== undefined) data.controlledSubstance = input.controlledSubstance;
    if (input.defaultWithdrawalMeatDays !== undefined) {
      data.defaultWithdrawalMeatDays = input.defaultWithdrawalMeatDays ?? null;
    }
    if (input.defaultWithdrawalMilkDays !== undefined) {
      data.defaultWithdrawalMilkDays = input.defaultWithdrawalMilkDays ?? null;
    }
    if (input.knowledgeEntryId !== undefined) data.knowledgeEntryId = input.knowledgeEntryId ?? null;
    if (input.sourceAttributionsJson !== undefined) {
      data.sourceAttributionsJson = input.sourceAttributionsJson ? toInputJson(input.sourceAttributionsJson) : null;
    }

    const row = await prisma.medicineGeneric.update({
      where: { id },
      data,
      include: { _count: { select: { brands: true } } },
    });

    return toGenericView(row);
  }

  async setActive(id: string, isActive: boolean): Promise<MedicineGenericView> {
    const prisma = getPrisma();
    await this.getById(id);

    const row = await prisma.medicineGeneric.update({
      where: { id },
      data: { isActive },
      include: { _count: { select: { brands: true } } },
    });

    return toGenericView(row);
  }

  async getActiveGenerics(params?: {
    species?: LivestockSpecies;
    limit?: number;
  }): Promise<MedicineGenericView[]> {
    const result = await this.list({
      isActive: true,
      species: params?.species,
      bannedSubstance: false,
      limit: params?.limit ?? 1000,
    });
    return result.items;
  }

  async searchByName(query: string, options?: {
    species?: LivestockSpecies;
    limit?: number;
  }): Promise<MedicineGenericView[]> {
    const result = await this.list({
      search: query,
      isActive: true,
      species: options?.species,
      limit: options?.limit ?? 20,
    });
    return result.items;
  }

  async getByKnowledgeEntryId(knowledgeEntryId: string): Promise<MedicineGenericView | null> {
    const prisma = getPrisma();
    const row = await prisma.medicineGeneric.findFirst({
      where: { knowledgeEntryId },
      include: { _count: { select: { brands: true } } },
    });
    return row ? toGenericView(row) : null;
  }

  async linkToKnowledgeEntry(id: string, knowledgeEntryId: string): Promise<MedicineGenericView> {
    return this.update(id, { knowledgeEntryId });
  }

  async getByDrugClass(drugClass: string): Promise<MedicineGenericView[]> {
    const result = await this.list({
      drugClass,
      isActive: true,
      limit: 500,
    });
    return result.items;
  }

  async getByTherapeuticCategory(category: string): Promise<MedicineGenericView[]> {
    const result = await this.list({
      therapeuticCategory: category,
      isActive: true,
      limit: 500,
    });
    return result.items;
  }
}

let service: GenericRegistryService | null = null;

export function getGenericRegistryService(): GenericRegistryService {
  if (!service) service = new GenericRegistryService();
  return service;
}

export function resetGenericRegistryServiceForTests(): void {
  service = null;
}
