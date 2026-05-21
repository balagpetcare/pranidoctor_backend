import { eventBus, EventTypes } from '../../shared/events/index.js';

import type { DoctorSpecialization } from './doctors.types.js';

export interface DoctorCreatedPayload {
  doctorId: string;
  userId: string;
  specialization: DoctorSpecialization[];
  timestamp: Date;
}

export interface DoctorUpdatedPayload {
  doctorId: string;
  changes: string[];
  timestamp: Date;
}

export interface DoctorVerifiedPayload {
  doctorId: string;
  userId: string;
  timestamp: Date;
}

export const doctorsEvents = {
  emitDoctorCreated: async (payload: DoctorCreatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.DOCTOR_CREATED, payload, 'doctors');
  },

  emitDoctorUpdated: async (payload: DoctorUpdatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.DOCTOR_UPDATED, payload, 'doctors');
  },

  emitDoctorVerified: async (payload: DoctorVerifiedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.DOCTOR_VERIFIED, payload, 'doctors');
  },
};
