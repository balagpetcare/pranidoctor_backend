import type { Media, MediaMetadata } from './media.types.js';
export interface UploadMediaDto {
  context: string;
  purpose: string;
  uploadedBy?: string;
  tenantId?: string;
}

export interface MediaResponseDto {
  id: string;
  fileId: string;
  context: string;
  objectKey: string;
  bucket: string;
  thumbnailKey?: string;
  metadata: MediaMetadata;
  uploadedBy?: string;
  tenantId?: string;
  status: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SignedUrlResponseDto {
  url: string;
  expiresAt: string;
  mediaId: string;
  variant: 'original' | 'thumbnail' | 'compressed';
}

export interface PresignUploadResponseDto {
  uploadUrl: string;
  objectKey: string;
  fileId: string;
  expiresAt: string;
  bucket: string;
}

export function toMediaResponseDto(media: Media, urls?: {
  downloadUrl?: string;
  thumbnailUrl?: string;
}): MediaResponseDto {
  const dto: MediaResponseDto = {
    id: media.id,
    fileId: media.fileId,
    context: media.context,
    objectKey: media.objectKey,
    bucket: media.bucket,
    metadata: media.metadata,
    status: media.status,
    createdAt: media.createdAt.toISOString(),
    updatedAt: media.updatedAt.toISOString(),
  };

  if (media.thumbnailKey) dto.thumbnailKey = media.thumbnailKey;
  if (media.uploadedBy) dto.uploadedBy = media.uploadedBy;
  if (media.tenantId) dto.tenantId = media.tenantId;
  if (urls?.downloadUrl) dto.downloadUrl = urls.downloadUrl;
  if (urls?.thumbnailUrl) dto.thumbnailUrl = urls.thumbnailUrl;

  return dto;
}
