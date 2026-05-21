import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateNotificationDto, SendSmsDto, SendPushDto } from './notifications.dto.js';
import { notificationsEvents } from './notifications.events.js';
import type { NotificationsRepositoryInterface } from './notifications.repository.js';
import type { Notification, NotificationFilter } from './notifications.types.js';

export interface NotificationsServiceInterface extends ModuleService {
  create(data: CreateNotificationDto): Promise<Notification>;
  send(data: CreateNotificationDto): Promise<Notification>;
  sendSms(data: SendSmsDto): Promise<void>;
  sendPush(data: SendPushDto): Promise<void>;
  markAsRead(ids: string[]): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  list(filter: NotificationFilter, page: number, pageSize: number): Promise<PaginatedResult<Notification>>;
  getUnreadCount(userId: string): Promise<number>;
}

export class NotificationsService implements NotificationsServiceInterface {
  readonly name = 'NotificationsService';

  constructor(private readonly repository: NotificationsRepositoryInterface) {}

  async create(data: CreateNotificationDto): Promise<Notification> {
    const notification = await this.repository.create(data);

    await notificationsEvents.emitNotificationCreated({
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      channel: notification.channel,
      timestamp: new Date(),
    });

    return notification;
  }

  async send(data: CreateNotificationDto): Promise<Notification> {
    const notification = await this.create(data);

    try {
      switch (data.channel) {
        case 'SMS':
          // TODO: Integrate with SMS provider
          break;
        case 'EMAIL':
          // TODO: Integrate with email provider
          break;
        case 'PUSH':
          // TODO: Integrate with push notification service
          break;
        case 'IN_APP':
          // Already stored, no additional action needed
          break;
      }

      await this.repository.updateStatus(notification.id, 'SENT');

      await notificationsEvents.emitNotificationSent({
        notificationId: notification.id,
        userId: notification.userId,
        channel: notification.channel,
        timestamp: new Date(),
      });

      return notification;
    } catch (error) {
      await this.repository.updateStatus(notification.id, 'FAILED');

      await notificationsEvents.emitNotificationFailed({
        notificationId: notification.id,
        userId: notification.userId,
        channel: notification.channel,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });

      throw error;
    }
  }

  async sendSms(_data: SendSmsDto): Promise<void> {
    // TODO: Implement SMS sending via provider in Phase 2
    // For now, this is a placeholder
    throw new Error('SMS sending not implemented - awaiting provider integration');
  }

  async sendPush(_data: SendPushDto): Promise<void> {
    // TODO: Implement push notification via FCM/APNS in Phase 2
    throw new Error('Push notifications not implemented - awaiting provider integration');
  }

  async markAsRead(ids: string[]): Promise<void> {
    await this.repository.markAsRead(ids);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.markAllAsRead(userId);
  }

  async list(filter: NotificationFilter, page: number, pageSize: number): Promise<PaginatedResult<Notification>> {
    return this.repository.list(filter, page, pageSize);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.getUnreadCount(userId);
  }
}
