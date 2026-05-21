import type {
  ServiceRequestEventType,
  UserRole,
} from '../../generated/prisma/index.js';

export type TimelineEventDto = {
  id: string;
  eventType: ServiceRequestEventType;
  actorUserId: string | null;
  actorRole: UserRole | null;
  actorDisplayName: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type ServiceRequestTimelineDto = {
  requestId: string;
  events: TimelineEventDto[];
};

export type AppendTimelineInput = {
  serviceRequestId: string;
  eventType: ServiceRequestEventType;
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
};
