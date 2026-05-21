import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateLeadDto, UpdateLeadDto, AssignLeadDto, ConvertLeadDto } from './leads.dto.js';
import { leadsEvents } from './leads.events.js';
import type { LeadsRepositoryInterface } from './leads.repository.js';
import type { Lead, LeadFilter, LeadActivity } from './leads.types.js';

export interface LeadsServiceInterface extends ModuleService {
  create(data: CreateLeadDto): Promise<Lead>;
  findById(id: string): Promise<Lead | null>;
  update(id: string, data: UpdateLeadDto, performedBy: string): Promise<Lead>;
  assign(id: string, data: AssignLeadDto, performedBy: string): Promise<Lead>;
  convert(id: string, data: ConvertLeadDto, performedBy: string): Promise<Lead>;
  list(filter: LeadFilter, page: number, pageSize: number): Promise<PaginatedResult<Lead>>;
  getActivities(leadId: string): Promise<LeadActivity[]>;
}

export class LeadsService implements LeadsServiceInterface {
  readonly name = 'LeadsService';

  constructor(private readonly repository: LeadsRepositoryInterface) {}

  async create(data: CreateLeadDto): Promise<Lead> {
    const lead = await this.repository.create(data);

    await this.repository.addActivity(lead.id, 'CREATED', 'Lead created', 'SYSTEM');

    await leadsEvents.emitLeadCreated({
      leadId: lead.id,
      phone: lead.phone,
      source: lead.source,
      timestamp: new Date(),
    });

    return lead;
  }

  async findById(id: string): Promise<Lead | null> {
    return this.repository.findById(id);
  }

  async update(id: string, data: UpdateLeadDto, performedBy: string): Promise<Lead> {
    const oldLead = await this.repository.findById(id);
    const lead = await this.repository.update(id, data);

    if (data.status && oldLead?.status !== data.status) {
      await this.repository.addActivity(
        id,
        'STATUS_CHANGED',
        `Status changed from ${oldLead?.status} to ${data.status}`,
        performedBy
      );

      await leadsEvents.emitLeadStatusChanged({
        leadId: lead.id,
        oldStatus: oldLead?.status ?? 'NEW',
        newStatus: data.status,
        timestamp: new Date(),
      });
    }

    return lead;
  }

  async assign(id: string, data: AssignLeadDto, performedBy: string): Promise<Lead> {
    const lead = await this.repository.assign(id, data.assignedTo);

    await this.repository.addActivity(
      id,
      'ASSIGNED',
      `Lead assigned to ${data.assignedTo}`,
      performedBy
    );

    await leadsEvents.emitLeadAssigned({
      leadId: lead.id,
      assignedTo: data.assignedTo,
      timestamp: new Date(),
    });

    return lead;
  }

  async convert(id: string, data: ConvertLeadDto, performedBy: string): Promise<Lead> {
    const lead = await this.repository.convert(id, data.userId);

    await this.repository.addActivity(
      id,
      'CONVERTED',
      `Lead converted to user ${data.userId}`,
      performedBy
    );

    await leadsEvents.emitLeadConverted({
      leadId: lead.id,
      userId: data.userId,
      timestamp: new Date(),
    });

    return lead;
  }

  async list(filter: LeadFilter, page: number, pageSize: number): Promise<PaginatedResult<Lead>> {
    return this.repository.list(filter, page, pageSize);
  }

  async getActivities(leadId: string): Promise<LeadActivity[]> {
    return this.repository.getActivities(leadId);
  }
}
