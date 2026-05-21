import { eventBus, EventTypes } from '../../shared/events/index.js';

import type { UserRole } from './users.types.js';

export interface UserCreatedPayload {
  userId: string;
  phone: string;
  role: UserRole;
  timestamp: Date;
}

export interface UserUpdatedPayload {
  userId: string;
  changes: string[];
  timestamp: Date;
}

export interface UserDeletedPayload {
  userId: string;
  timestamp: Date;
}

export const usersEvents = {
  emitUserCreated: async (payload: UserCreatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.USER_CREATED, payload, 'users');
  },

  emitUserUpdated: async (payload: UserUpdatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.USER_UPDATED, payload, 'users');
  },

  emitUserDeleted: async (payload: UserDeletedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.USER_DELETED, payload, 'users');
  },
};
