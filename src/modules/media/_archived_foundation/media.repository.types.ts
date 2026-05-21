import type { MediaContextType, MediaMetadata } from './media.types.js';

export interface CreateMediaRecordInput {
  fileId: string;
  context: MediaContextType;
  objectKey: string;
  bucket: string;
  thumbnailKey?: string;
  compressedKey?: string;
  metadata: MediaMetadata;
  uploadedBy?: string;
  tenantId?: string;
}
