import { eventBus, EventTypes } from '../../shared/events/index.js';

import type { NotificationType, NotificationChannel } from './notifications.types.js';

export interface NotificationCreatedPayload {
  notificationId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  timestamp: Date;
}

export interface NotificationSentPayload {
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  timestamp: Date;
}

export interface NotificationFailedPayload {
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  error: string;
  timestamp: Date;
}

export const notificationsEvents = {
  emitNotificationCreated: async (payload: NotificationCreatedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.NOTIFICATION_CREATED, payload, 'notifications');
  },

  emitNotificationSent: async (payload: NotificationSentPayload): Promise<void> => {
    await eventBus.publish(EventTypes.NOTIFICATION_SENT, payload, 'notifications');
  },

  emitNotificationFailed: async (payload: NotificationFailedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.NOTIFICATION_FAILED, payload, 'notifications');
  },
};
