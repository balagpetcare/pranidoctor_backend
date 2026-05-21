import type { AppConfig } from '../../shared/config/config.schema.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/http.errors.js';
import { logInfo } from '../../shared/logger/logger.js';
import type { IStorageProvider } from './storage/interfaces/storage-provider.interface.js';

import {
  buildObjectKey,
  generateFileId,
  getExtensionFromMime,
  sanitizeFilename,
} from './media.folder.js';
import { compressImage, generateThumbnail, isRasterImage } from './media.image.processor.js';
import type { MediaRepositoryInterface } from './media.repository.js';
import type { Media, MediaContextType, MediaPurposeType } from './media.types.js';
import { MediaCategory, MediaStatus } from './media.types.js';
import { validateMimeType, validateUpload } from './media.validation.js';
import type { PresignUploadInput, SignedUrlQuery } from './media.validator.js';
import { publishMediaDeleted, publishMediaUploaded } from './media.events.js';

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  declaredMime?: string;
  context: MediaContextType;
  purpose: MediaPurposeType;
  uploadedBy?: string;
  tenantId?: string;
}

export interface MediaServiceInterface {
  upload(input: UploadFileInput): Promise<Media>;
  getById(id: string): Promise<Media | null>;
  getSignedUrl(id: string, query: SignedUrlQuery, requesterId?: string): Promise<{
    url: string;
    expiresAt: Date;
    variant: SignedUrlQuery['variant'];
  }>;
  presignUpload(input: PresignUploadInput, uploadedBy?: string): Promise<{
    uploadUrl: string;
    objectKey: string;
    fileId: string;
    expiresAt: Date;
    bucket: string;
  }>;
  delete(id: string, requesterId?: string): Promise<void>;
  listByUploader(uploadedBy: string, limit?: number): Promise<Media[]>;
}

export class MediaService implements MediaServiceInterface {
  readonly name = 'MediaService';

  constructor(
    private readonly repository: MediaRepositoryInterface,
    private readonly storage: IStorageProvider,
    private readonly config: AppConfig
  ) {}

  async upload(input: UploadFileInput): Promise<Media> {
    if (!this.storage.isConfigured()) {
      throw new BadRequestError('STORAGE_NOT_CONFIGURED', 'Storage is not configured');
    }

    const validateInput: Parameters<typeof validateUpload>[0] = {
      buffer: input.buffer,
      originalName: input.originalName,
      purpose: input.purpose,
    };
    if (input.declaredMime) validateInput.declaredMime = input.declaredMime;

    const validated = validateUpload(validateInput, this.config);

    const fileId = generateFileId();
    let uploadBuffer = validated.buffer;
    let mimeType = validated.mimeType;
    let width: number | undefined;
    let height: number | undefined;
    let compressed = false;
    let thumbnailKey: string | undefined;
    let compressedKey: string | undefined;

    if (validated.category === MediaCategory.IMAGE && isRasterImage(mimeType)) {
      const processed = await compressImage(validated.buffer, mimeType);
      uploadBuffer = processed.buffer;
      mimeType = processed.mimeType;
      width = processed.width;
      height = processed.height;
      compressed = processed.mimeType === 'image/webp';
    }

    const extension = getExtensionFromMime(mimeType);
    const objectKey = buildObjectKey({
      context: input.context,
      fileId,
      extension,
      variant: 'original',
    });

    await this.storage.putObject({
      key: objectKey,
      body: uploadBuffer,
      contentType: mimeType,
      metadata: {
        fileId,
        purpose: input.purpose,
        uploadedBy: input.uploadedBy ?? '',
      },
    });

    if (validated.category === MediaCategory.IMAGE && isRasterImage(validated.mimeType)) {
      try {
        const thumbnail = await generateThumbnail(uploadBuffer, objectKey);
        await this.storage.putObject({
          key: thumbnail.objectKey,
          body: thumbnail.buffer,
          contentType: thumbnail.mimeType,
        });
        thumbnailKey = thumbnail.objectKey;
      } catch {
        thumbnailKey = undefined;
      }
    }

    if (compressed && uploadBuffer !== validated.buffer) {
      compressedKey = buildObjectKey({
        context: input.context,
        fileId,
        extension,
        variant: 'compressed',
      });
    }

    const metadata: Media['metadata'] = {
      originalName: sanitizeFilename(input.originalName),
      mimeType,
      size: uploadBuffer.length,
      checksum: validated.checksum,
      category: validated.category,
      purpose: input.purpose,
      compressed,
      hasThumbnail: Boolean(thumbnailKey),
    };
    if (width !== undefined) metadata.width = width;
    if (height !== undefined) metadata.height = height;

    const createInput: Parameters<MediaRepositoryInterface['create']>[0] = {
      fileId,
      context: input.context,
      objectKey,
      bucket: this.config.storage.bucket,
      metadata,
    };
    if (thumbnailKey) createInput.thumbnailKey = thumbnailKey;
    if (compressedKey) createInput.compressedKey = compressedKey;
    if (input.uploadedBy) createInput.uploadedBy = input.uploadedBy;
    if (input.tenantId) createInput.tenantId = input.tenantId;

    const media = await this.repository.create(createInput);

    logInfo('Media uploaded', {
      mediaId: media.id,
      fileId,
      context: input.context,
      size: uploadBuffer.length,
    });

    const uploadedEvent: Parameters<typeof publishMediaUploaded>[0] = {
      mediaId: media.id,
      fileId,
      context: input.context,
      mimeType,
      size: uploadBuffer.length,
    };
    if (input.uploadedBy) uploadedEvent.uploadedBy = input.uploadedBy;
    publishMediaUploaded(uploadedEvent);

    return media;
  }

  async getById(id: string): Promise<Media | null> {
    const media = await this.repository.findById(id);
    if (!media || media.status === MediaStatus.DELETED) {
      return null;
    }
    return media;
  }

  async getSignedUrl(
    id: string,
    query: SignedUrlQuery,
    requesterId?: string
  ): Promise<{ url: string; expiresAt: Date; variant: SignedUrlQuery['variant'] }> {
    const media = await this.getById(id);
    if (!media) {
      throw new NotFoundError('MEDIA_NOT_FOUND', 'Media not found');
    }

    if (requesterId && media.uploadedBy && media.uploadedBy !== requesterId) {
      throw new ForbiddenError('MEDIA_ACCESS_DENIED', 'Access denied');
    }

    let key = media.objectKey;
    if (query.variant === 'thumbnail' && media.thumbnailKey) {
      key = media.thumbnailKey;
    } else if (query.variant === 'compressed' && media.compressedKey) {
      key = media.compressedKey;
    }

    const expiresIn = query.expiresIn ?? this.config.storage.signedUrlExpirySeconds;
    const url = await this.storage.getSignedGetUrl({ key, expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return { url, expiresAt, variant: query.variant };
  }

  async presignUpload(
    input: PresignUploadInput,
    uploadedBy?: string
  ): Promise<{
    uploadUrl: string;
    objectKey: string;
    fileId: string;
    expiresAt: Date;
    bucket: string;
  }> {
    if (!this.storage.isConfigured()) {
      throw new BadRequestError('STORAGE_NOT_CONFIGURED', 'Storage is not configured');
    }

    const mimeType = input.mimeType.toLowerCase();
    validateMimeType(mimeType, input.originalName, this.config);

    const fileId = generateFileId();
    const extension = getExtensionFromMime(mimeType);
    const objectKey = buildObjectKey({
      context: input.context,
      fileId,
      extension,
    });

    const expiresIn = this.config.storage.signedUrlExpirySeconds;
    const uploadUrl = await this.storage.getSignedPutUrl({ key: objectKey, expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    logInfo('Presigned upload URL generated', {
      fileId,
      objectKey,
      uploadedBy,
    });

    return {
      uploadUrl,
      objectKey,
      fileId,
      expiresAt,
      bucket: this.config.storage.bucket,
    };
  }

  async delete(id: string, requesterId?: string): Promise<void> {
    const media = await this.getById(id);
    if (!media) {
      throw new NotFoundError('MEDIA_NOT_FOUND', 'Media not found');
    }

    if (requesterId && media.uploadedBy && media.uploadedBy !== requesterId) {
      throw new ForbiddenError('MEDIA_ACCESS_DENIED', 'Access denied');
    }

    await this.repository.softDelete(id);

    try {
      await this.storage.deleteObject(media.objectKey);
      if (media.thumbnailKey) {
        await this.storage.deleteObject(media.thumbnailKey);
      }
      if (media.compressedKey) {
        await this.storage.deleteObject(media.compressedKey);
      }
    } catch {
      // Metadata marked deleted; object cleanup can be retried async
    }

    const deletedEvent: Parameters<typeof publishMediaDeleted>[0] = {
      mediaId: id,
      fileId: media.fileId,
    };
    if (media.uploadedBy) deletedEvent.uploadedBy = media.uploadedBy;
    publishMediaDeleted(deletedEvent);

    logInfo('Media deleted', { mediaId: id });
  }

  async listByUploader(uploadedBy: string, limit?: number): Promise<Media[]> {
    return this.repository.findByUploader(uploadedBy, limit);
  }
}
