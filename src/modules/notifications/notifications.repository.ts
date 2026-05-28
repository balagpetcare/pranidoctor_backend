import { throwFoundationNotImplemented } from '../../shared/errors/index.js';
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
    throwFoundationNotImplemented('Notifications foundation API');
  }

  async findById(_id: string): Promise<Notification | null> {
    throwFoundationNotImplemented('Notifications foundation API');
  }

  async updateStatus(_id: string , _status: Notification['status']): Promise<Notification> {
    throwFoundationNotImplemented('Notifications foundation API');
  }

  async markAsRead(_ids: string[]): Promise<void> {
    throwFoundationNotImplemented('Notifications foundation API');
  }

  async markAllAsRead(_userId: string): Promise<void> {
    throwFoundationNotImplemented('Notifications foundation API');
  }

  async list(_filter: NotificationFilter, _page: number, _pageSize: number): Promise<PaginatedResult<Notification>> {
    throwFoundationNotImplemented('Notifications foundation API');
  }

  async getUnreadCount(_userId: string): Promise<number> {
    throwFoundationNotImplemented('Notifications foundation API');
  }

  async getTemplate(_type: NotificationType, _channel: NotificationChannel): Promise<NotificationTemplate | null> {
    throwFoundationNotImplemented('Notifications foundation API');
  }
}


