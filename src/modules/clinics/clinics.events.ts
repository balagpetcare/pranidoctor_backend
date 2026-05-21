import { eventBus, EventTypes } from '../../shared/events/index.js';

export interface ClinicCreatedPayload {
  clinicId: string;
  ownerId: string;
  name: string;
  timestamp: Date;
}

export interface ClinicUpdatedPayload {
  clinicId: string;
  changes: string[];
  timestamp: Date;
}

export const clinicsEvents = {
  emitClinicCreated: async (payload: ClinicCreatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.CLINIC_CREATED, payload, 'clinics');
  },

  emitClinicUpdated: async (payload: ClinicUpdatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.CLINIC_UPDATED, payload, 'clinics');
  },
};
