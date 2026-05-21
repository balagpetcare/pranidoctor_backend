export const MediaContext = {
  FARMER: 'farmer',
  DOCTOR: 'doctor',
  AI_TECH: 'ai-tech',
  ADMIN: 'admin',
} as const;

export type MediaContextType = (typeof MediaContext)[keyof typeof MediaContext];

export const MediaCategory = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  VIDEO: 'video',
} as const;

export type MediaCategoryType = (typeof MediaCategory)[keyof typeof MediaCategory];

export const MediaStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  DELETED: 'DELETED',
} as const;

export type MediaStatusType = (typeof MediaStatus)[keyof typeof MediaStatus];

export const MediaPurpose = {
  PROFILE_PHOTO: 'profile_photo',
  COVER_IMAGE: 'cover_image',
  NID_FRONT: 'nid_front',
  NID_BACK: 'nid_back',
  CERTIFICATE: 'certificate',
  GALLERY: 'gallery',
  DOCUMENT: 'document',
  MEDICAL_RECORD: 'medical_record',
  ANIMAL_PHOTO: 'animal_photo',
  GENERAL: 'general',
} as const;

export type MediaPurposeType = (typeof MediaPurpose)[keyof typeof MediaPurpose];

export interface MediaMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  checksum: string;
  category: MediaCategoryType;
  purpose: MediaPurposeType;
  compressed?: boolean;
  hasThumbnail?: boolean;
}

export interface Media {
  id: string;
  fileId: string;
  context: MediaContextType;
  objectKey: string;
  bucket: string;
  thumbnailKey?: string;
  compressedKey?: string;
  metadata: MediaMetadata;
  uploadedBy?: string;
  tenantId?: string;
  status: MediaStatusType;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  extension: string;
}

export interface ThumbnailResult {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  objectKey: string;
}
