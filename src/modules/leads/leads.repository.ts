import type {
  LeadActivityType as PrismaLeadActivityType,
  LeadPriority as PrismaLeadPriority,
  LeadSource as PrismaLeadSource,
  LeadStatus as PrismaLeadStatus,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';
import { omitUndefined } from '../../shared/types/object.utils.js';
import { createPaginationMeta } from '../../shared/utils/pagination.js';

import type { CreateLeadDto, UpdateLeadDto } from './leads.dto.js';
import type {
  Lead,
  LeadActivity,
  LeadActivityType,
  LeadFilter,
  LeadPriority,
  LeadSource,
  LeadStatus,
} from './leads.types.js';

export interface LeadsRepositoryInterface extends ModuleService {
  create(data: CreateLeadDto): Promise<Lead>;
  findById(id: string): Promise<Lead | null>;
  findByPhone(phone: string): Promise<Lead | null>;
  update(id: string, data: UpdateLeadDto): Promise<Lead>;
  assign(id: string, assignedTo: string): Promise<Lead>;
  convert(id: string, userId: string): Promise<Lead>;
  list(filter: LeadFilter, page: number, pageSize: number): Promise<PaginatedResult<Lead>>;
  getActivities(leadId: string): Promise<LeadActivity[]>;
  addActivity(
    leadId: string,
    type: LeadActivityType,
    description: string,
    performedBy: string,
  ): Promise<LeadActivity>;
}

function mapLead(row: {
  id: string;
  phone: string;
  name: string | null;
  source: PrismaLeadSource;
  status: PrismaLeadStatus;
  priority: PrismaLeadPriority;
  assignedAdminId: string | null;
  animalType: string | null;
  concern: string | null;
  notes: string | null;
  convertedUserId: string | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Lead {
  return omitUndefined({
    id: row.id,
    userId: row.convertedUserId ?? undefined,
    phone: row.phone,
    name: row.name ?? undefined,
    source: row.source as LeadSource,
    status: row.status as LeadStatus,
    priority: row.priority as LeadPriority,
    assignedTo: row.assignedAdminId ?? undefined,
    animalType: row.animalType ?? undefined,
    concern: row.concern ?? undefined,
    notes: row.notes ?? undefined,
    convertedAt: row.convertedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }) as Lead;
}

function mapActivity(row: {
  id: string;
  leadId: string;
  activityType: PrismaLeadActivityType;
  description: string;
  performedBy: string;
  createdAt: Date;
}): LeadActivity {
  return {
    id: row.id,
    leadId: row.leadId,
    activityType: row.activityType as LeadActivityType,
    description: row.description,
    performedBy: row.performedBy,
    createdAt: row.createdAt,
  };
}

export class LeadsRepository implements LeadsRepositoryInterface {
  readonly name = 'LeadsRepository';

  async create(data: CreateLeadDto): Promise<Lead> {
    const prisma = getPrisma();
    const row = await prisma.lead.create({
      data: omitUndefined({
        phone: data.phone,
        name: data.name,
        source: data.source as PrismaLeadSource,
        status: 'NEW' as const,
        priority: (data.priority ?? 'MEDIUM') as PrismaLeadPriority,
        convertedUserId: data.userId,
        animalType: data.animalType,
        concern: data.concern,
        notes: data.notes,
      }),
    });
    return mapLead(row);
  }

  async findById(id: string): Promise<Lead | null> {
    const prisma = getPrisma();
    const row = await prisma.lead.findUnique({ where: { id } });
    return row ? mapLead(row) : null;
  }

  async findByPhone(phone: string): Promise<Lead | null> {
    const prisma = getPrisma();
    const row = await prisma.lead.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    return row ? mapLead(row) : null;
  }

  async update(id: string, data: UpdateLeadDto): Promise<Lead> {
    const prisma = getPrisma();
    const row = await prisma.lead.update({
      where: { id },
      data: omitUndefined({
        name: data.name,
        status: data.status as PrismaLeadStatus | undefined,
        priority: data.priority as PrismaLeadPriority | undefined,
        notes: data.notes,
        concern: data.concern,
      }),
    });
    return mapLead(row);
  }

  async assign(id: string, assignedTo: string): Promise<Lead> {
    const prisma = getPrisma();
    const row = await prisma.lead.update({
      where: { id },
      data: { assignedAdminId: assignedTo },
    });
    return mapLead(row);
  }

  async convert(id: string, userId: string): Promise<Lead> {
    const prisma = getPrisma();
    const row = await prisma.lead.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        convertedUserId: userId,
        convertedAt: new Date(),
      },
    });
    return mapLead(row);
  }

  async list(
    filter: LeadFilter,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<Lead>> {
    const prisma = getPrisma();
    const where = {
      ...(filter.status ? { status: filter.status as PrismaLeadStatus } : {}),
      ...(filter.priority ? { priority: filter.priority as PrismaLeadPriority } : {}),
      ...(filter.source ? { source: filter.source as PrismaLeadSource } : {}),
      ...(filter.assignedTo ? { assignedAdminId: filter.assignedTo } : {}),
      ...(filter.search
        ? {
            OR: [
              { phone: { contains: filter.search, mode: 'insensitive' as const } },
              { name: { contains: filter.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(filter.dateFrom || filter.dateTo
        ? {
            createdAt: {
              ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo ? { lte: filter.dateTo } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      data: rows.map(mapLead),
      meta: createPaginationMeta(total, page, pageSize),
    };
  }

  async getActivities(leadId: string): Promise<LeadActivity[]> {
    const prisma = getPrisma();
    const rows = await prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapActivity);
  }

  async addActivity(
    leadId: string,
    type: LeadActivityType,
    description: string,
    performedBy: string,
  ): Promise<LeadActivity> {
    const prisma = getPrisma();
    const row = await prisma.leadActivity.create({
      data: {
        leadId,
        activityType: type as PrismaLeadActivityType,
        description,
        performedBy,
      },
    });
    return mapActivity(row);
  }
}
