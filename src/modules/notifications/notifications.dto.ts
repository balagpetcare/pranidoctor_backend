import type {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationTemplate,
} from './notifications.types.js';
import { omitUndefined } from '../../shared/types/object.utils.js';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  scheduledFor?: Date;
}

export interface SendSmsDto {
  phone: string;
  message: string;
  type?: NotificationType;
}

export interface SendPushDto {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationResponseDto {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  status: NotificationStatus;
  sentAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface NotificationTemplateResponseDto {
  id: string;
  name: string;
  type: NotificationType;
  channel: NotificationChannel;
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
}

export function toNotificationResponseDto(notification: Notification): NotificationResponseDto {
  return omitUndefined({
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    channel: notification.channel,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    status: notification.status,
    sentAt: notification.sentAt?.toISOString(),
    readAt: notification.readAt?.toISOString(),
    createdAt: notification.createdAt.toISOString(),
  });
}

export function toNotificationTemplateResponseDto(template: NotificationTemplate): NotificationTemplateResponseDto {
  return {
    id: template.id,
    name: template.name,
    type: template.type,
    channel: template.channel,
    titleTemplate: template.titleTemplate,
    bodyTemplate: template.bodyTemplate,
    isActive: template.isActive,
  };
}
