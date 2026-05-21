import type { Lead, LeadSource, LeadStatus, LeadPriority, LeadActivity } from './leads.types.js';
import { omitUndefined } from '../../shared/types/object.utils.js';

export interface CreateLeadDto {
  phone: string;
  name?: string;
  userId?: string;
  source: LeadSource;
  animalType?: string;
  concern?: string;
  notes?: string;
  priority?: LeadPriority;
}

export interface UpdateLeadDto {
  name?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  notes?: string;
  concern?: string;
}

export interface AssignLeadDto {
  assignedTo: string;
}

export interface ConvertLeadDto {
  userId: string;
}

export interface LeadResponseDto {
  id: string;
  userId?: string;
  phone: string;
  name?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo?: string;
  animalType?: string;
  concern?: string;
  notes?: string;
  convertedAt?: string;
  createdAt: string;
}

export interface LeadActivityResponseDto {
  id: string;
  leadId: string;
  activityType: string;
  description: string;
  performedBy: string;
  createdAt: string;
}

export function toLeadResponseDto(lead: Lead): LeadResponseDto {
  return omitUndefined({
    id: lead.id,
    userId: lead.userId,
    phone: lead.phone,
    name: lead.name,
    source: lead.source,
    status: lead.status,
    priority: lead.priority,
    assignedTo: lead.assignedTo,
    animalType: lead.animalType,
    concern: lead.concern,
    notes: lead.notes,
    convertedAt: lead.convertedAt?.toISOString(),
    createdAt: lead.createdAt.toISOString(),
  });
}

export function toLeadActivityResponseDto(activity: LeadActivity): LeadActivityResponseDto {
  return {
    id: activity.id,
    leadId: activity.leadId,
    activityType: activity.activityType,
    description: activity.description,
    performedBy: activity.performedBy,
    createdAt: activity.createdAt.toISOString(),
  };
}
