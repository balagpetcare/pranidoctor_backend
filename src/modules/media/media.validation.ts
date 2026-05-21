import { createHash } from 'crypto';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { BadRequestError } from '../../shared/errors/http.errors.js';
import {
  isDangerousExtension,
  isDangerousMime,
  sniffMimeFromBuffer,
} from '../../infra/storage/mime-sniff.js';

import type { MediaCategoryType, MediaPurposeType } from './media.types.js';
import { MediaCategory } from './media.types.js';

export interface ValidateUploadInput {
  buffer: Buffer;
  originalName: string;
  declaredMime?: string;
  purpose: MediaPurposeType;
}

export interface ValidatedUpload {
  buffer: Buffer;
  mimeType: string;
  category: MediaCategoryType;
  checksum: string;
  maxBytes: number;
}

function getCategoryFromMime(mime: string, config: AppConfig): MediaCategoryType {
  if (config.storage.allowedVideoMimes.includes(mime)) {
    return MediaCategory.VIDEO;
  }
  if (config.storage.allowedDocumentMimes.includes(mime)) {
    return MediaCategory.DOCUMENT;
  }
  if (config.storage.allowedImageMimes.includes(mime)) {
    return MediaCategory.IMAGE;
  }
  throw new BadRequestError('UPLOAD_INVALID_TYPE', `File type not allowed: ${mime}`);
}

function getMaxBytes(category: MediaCategoryType, config: AppConfig): number {
  switch (category) {
    case MediaCategory.VIDEO:
      return config.storage.maxVideoBytes;
    case MediaCategory.DOCUMENT:
      return config.storage.maxDocumentBytes;
    case MediaCategory.IMAGE:
    default:
      return config.storage.maxImageBytes;
  }
}

function isAllowedMime(mime: string, category: MediaCategoryType, config: AppConfig): boolean {
  switch (category) {
    case MediaCategory.VIDEO:
      return config.storage.allowedVideoMimes.includes(mime);
    case MediaCategory.DOCUMENT:
      return config.storage.allowedDocumentMimes.includes(mime);
    case MediaCategory.IMAGE:
      return config.storage.allowedImageMimes.includes(mime);
    default:
      return false;
  }
}

export function validateMimeType(
  mimeType: string,
  originalName: string,
  config: AppConfig
): { mimeType: string; category: MediaCategoryType } {
  if (config.storage.driver === 'disabled') {
    throw new BadRequestError('STORAGE_DISABLED', 'File uploads are disabled');
  }

  if (isDangerousExtension(originalName) || isDangerousMime(mimeType)) {
    throw new BadRequestError('UPLOAD_DANGEROUS_FILE', 'File type not allowed');
  }

  const category = getCategoryFromMime(mimeType, config);

  if (!isAllowedMime(mimeType, category, config)) {
    throw new BadRequestError('UPLOAD_INVALID_TYPE', `File type not allowed: ${mimeType}`);
  }

  return { mimeType, category };
}

export function validateUpload(
  input: ValidateUploadInput,
  config: AppConfig
): ValidatedUpload {
  if (config.storage.driver === 'disabled') {
    throw new BadRequestError('STORAGE_DISABLED', 'File uploads are disabled');
  }

  if (!config.storage.accessKeyId || !config.storage.secretAccessKey) {
    throw new BadRequestError('STORAGE_NOT_CONFIGURED', 'Storage is not configured');
  }

  if (isDangerousExtension(input.originalName)) {
    throw new BadRequestError('UPLOAD_DANGEROUS_FILE', 'File type not allowed');
  }

  const sniffed = sniffMimeFromBuffer(input.buffer);
  const mimeType = sniffed ?? input.declaredMime?.toLowerCase();

  if (!mimeType) {
    throw new BadRequestError('UPLOAD_INVALID_TYPE', 'Could not determine file type');
  }

  if (isDangerousMime(mimeType)) {
    throw new BadRequestError('UPLOAD_DANGEROUS_FILE', 'File type not allowed');
  }

  const category = getCategoryFromMime(mimeType, config);

  if (!isAllowedMime(mimeType, category, config)) {
    throw new BadRequestError('UPLOAD_INVALID_TYPE', `File type not allowed: ${mimeType}`);
  }

  const maxBytes = getMaxBytes(category, config);

  if (input.buffer.length > maxBytes) {
    throw new BadRequestError('UPLOAD_FILE_TOO_LARGE', 'File exceeds maximum allowed size', {
      maxBytes,
      actualBytes: input.buffer.length,
      category,
    });
  }

  const checksum = createHash('sha256').update(input.buffer).digest('hex');

  return {
    buffer: input.buffer,
    mimeType,
    category,
    checksum,
    maxBytes,
  };
}
