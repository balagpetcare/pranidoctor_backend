export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  status: NotificationStatus;
  sentAt?: Date;
  readAt?: Date;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType =
  | 'OTP'
  | 'APPOINTMENT_REMINDER'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_CANCELLED'
  | 'LEAD_ASSIGNED'
  | 'DOCTOR_VERIFIED'
  | 'EMERGENCY_ALERT'
  | 'PAYMENT_RECEIVED'
  | 'SYSTEM'
  | 'MARKETING';

export type NotificationChannel = 'SMS' | 'EMAIL' | 'PUSH' | 'IN_APP';

export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channel: NotificationChannel;
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  scheduledFor?: Date;
}

export interface NotificationFilter {
  userId?: string;
  type?: NotificationType;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  unreadOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}
