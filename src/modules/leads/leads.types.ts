export interface Lead {
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
  convertedAt?: Date;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LeadSource =
  | 'AI_CHAT'
  | 'PHONE'
  | 'WEBSITE'
  | 'REFERRAL'
  | 'SOCIAL_MEDIA'
  | 'WALK_IN'
  | 'OTHER';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'CONSULTATION_SCHEDULED'
  | 'CONVERTED'
  | 'LOST'
  | 'FOLLOW_UP';

export type LeadPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export interface LeadActivity {
  id: string;
  leadId: string;
  activityType: LeadActivityType;
  description: string;
  performedBy: string;
  createdAt: Date;
}

export type LeadActivityType =
  | 'CREATED'
  | 'CALLED'
  | 'MESSAGED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'NOTE_ADDED'
  | 'CONVERTED';

export interface LeadFilter {
  status?: LeadStatus;
  priority?: LeadPriority;
  source?: LeadSource;
  assignedTo?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}
