import { eventBus, EventTypes } from '../../shared/events/index.js';

import type { LeadSource, LeadStatus } from './leads.types.js';

export interface LeadCreatedPayload {
  leadId: string;
  phone: string;
  source: LeadSource;
  timestamp: Date;
}

export interface LeadAssignedPayload {
  leadId: string;
  assignedTo: string;
  timestamp: Date;
}

export interface LeadStatusChangedPayload {
  leadId: string;
  oldStatus: LeadStatus;
  newStatus: LeadStatus;
  timestamp: Date;
}

export interface LeadConvertedPayload {
  leadId: string;
  userId: string;
  timestamp: Date;
}

export const leadsEvents = {
  emitLeadCreated: async (payload: LeadCreatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.LEAD_CREATED, payload, 'leads');
  },

  emitLeadAssigned: async (payload: LeadAssignedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.LEAD_ASSIGNED, payload, 'leads');
  },

  emitLeadStatusChanged: async (payload: LeadStatusChangedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.LEAD_STATUS_CHANGED, payload, 'leads');
  },

  emitLeadConverted: async (payload: LeadConvertedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.LEAD_CONVERTED, payload, 'leads');
  },
};
