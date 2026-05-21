export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  timestamp: Date;
  source: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  unsubscribe: () => void;
}

export const EventTypes = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',

  AUTH_OTP_REQUESTED: 'auth.otp.requested',
  AUTH_OTP_VERIFIED: 'auth.otp.verified',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',

  DOCTOR_CREATED: 'doctor.created',
  DOCTOR_UPDATED: 'doctor.updated',
  DOCTOR_VERIFIED: 'doctor.verified',

  LEAD_CREATED: 'lead.created',
  LEAD_ASSIGNED: 'lead.assigned',
  LEAD_STATUS_CHANGED: 'lead.status.changed',
  LEAD_CONVERTED: 'lead.converted',

  ANIMAL_CREATED: 'animal.created',
  ANIMAL_UPDATED: 'animal.updated',

  CLINIC_CREATED: 'clinic.created',
  CLINIC_UPDATED: 'clinic.updated',

  AI_CONVERSATION_STARTED: 'ai.conversation.started',
  AI_CONVERSATION_ENDED: 'ai.conversation.ended',
  AI_MESSAGE_SENT: 'ai.message.sent',
  AI_EMERGENCY_DETECTED: 'ai.emergency.detected',

  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_FAILED: 'notification.failed',

  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_DELETED: 'media.deleted',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
