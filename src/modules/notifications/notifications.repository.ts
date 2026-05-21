import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { CreateNotificationDto } from './notifications.dto.js';
import type { Notification, NotificationFilter, NotificationTemplate, NotificationType, NotificationChannel } from './notifications.types.js';

export interface NotificationsRepositoryInterface extends ModuleService {
  create(data: CreateNotificationDto): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  updateStatus(id: string , _status: Notification['status']): Promise<Notification>;
  markAsRead(_ids: string[]): Promise<void>;
  markAllAsRead(_userId: string): Promise<void>;
  list(filter: NotificationFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Notification>>;
  getUnreadCount(userId: string): Promise<number>;
  getTemplate(type: NotificationType, channel: NotificationChannel): Promise<NotificationTemplate | null>;
}

export class NotificationsRepository implements NotificationsRepositoryInterface {
  readonly name = 'NotificationsRepository';

  async create(_data: CreateNotificationDto): Promise<Notification> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async findById(_id: string): Promise<Notification | null> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async updateStatus(_id: string , _status: Notification['status']): Promise<Notification> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async markAsRead(_ids: string[]): Promise<void> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async markAllAsRead(_userId: string): Promise<void> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async list(_filter: NotificationFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Notification>> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async getUnreadCount(_userId: string): Promise<number> {
    throw new Error('Not implemented - awaiting database migration');
  }

  async getTemplate(_type: NotificationType, _channel: NotificationChannel): Promise<NotificationTemplate | null> {
    throw new Error('Not implemented - awaiting database migration');
  }
}


