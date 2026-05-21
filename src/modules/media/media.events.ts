import { eventBus } from '../../shared/events/event-bus.js';
import { EventTypes } from '../../shared/events/event.types.js';

export const MediaEventTypes = {
  UPLOADED: 'media.uploaded',
  DELETED: 'media.deleted',
} as const;

export interface MediaUploadedEvent {
  mediaId: string;
  fileId: string;
  context: string;
  uploadedBy?: string | undefined;
  mimeType: string;
  size: number;
}

export interface MediaDeletedEvent {
  mediaId: string;
  fileId: string;
  uploadedBy?: string | undefined;
}

export function publishMediaUploaded(payload: MediaUploadedEvent): void {
  void eventBus.publish(EventTypes.MEDIA_UPLOADED, payload, 'media');
}

export function publishMediaDeleted(payload: MediaDeletedEvent): void {
  void eventBus.publish(EventTypes.MEDIA_DELETED, payload, 'media');
}
