import type { FileCategory, Prisma } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { activeOnly } from '../../shared/database/soft-delete.js';
import type { ModuleService } from '../../shared/module/module.types.js';

import type { CreateMediaRecordInput } from './media.repository.types.js';
import type { Media, MediaMetadata } from './media.types.js';
import { MediaStatus } from './media.types.js';
import type { MediaContextType } from './media.types.js';

export type { CreateMediaRecordInput } from './media.repository.types.js';

export interface MediaRepositoryInterface extends ModuleService {
  create(data: CreateMediaRecordInput): Promise<Media>;
  findById(id: string): Promise<Media | null>;
  findByFileId(fileId: string): Promise<Media | null>;
  softDelete(id: string): Promise<Media>;
  findByUploader(uploadedBy: string, limit?: number): Promise<Media[]>;
}

const PURPOSE_TO_CATEGORY: Record<string, FileCategory> = {
  profile_photo: 'PROFILE_PHOTO',
  cover_image: 'COVER_IMAGE',
  nid_front: 'NID_FRONT',
  nid_back: 'NID_BACK',
  certificate: 'CERTIFICATE',
  gallery: 'GALLERY',
  document: 'DOCUMENT',
  medical_record: 'MEDICAL_RECORD',
  animal_photo: 'ANIMAL_PHOTO',
  general: 'GENERAL',
};

function mapRecord(record: {
  id: string;
  fileId: string;
  context: string;
  storageKey: string;
  bucket: string;
  thumbnailKey: string | null;
  compressedKey: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  width: number | null;
  height: number | null;
  fileCategory: FileCategory;
  metadata: Prisma.JsonValue | null;
  ownerUserId: string | null;
  tenantId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): Media {
  const meta = (record.metadata ?? {}) as Record<string, unknown>;

  const metadata: MediaMetadata = {
    originalName: record.originalName,
    mimeType: record.mimeType,
    size: record.sizeBytes,
    checksum: record.checksum ?? (meta['checksum'] as string) ?? '',
    category: (meta['category'] as MediaMetadata['category']) ?? 'image',
    purpose: (meta['purpose'] as MediaMetadata['purpose']) ?? 'general',
    compressed: Boolean(meta['compressed']),
    hasThumbnail: Boolean(record.thumbnailKey),
  };

  if (record.width) metadata.width = record.width;
  if (record.height) metadata.height = record.height;

  const media: Media = {
    id: record.id,
    fileId: record.fileId,
    context: record.context as MediaContextType,
    objectKey: record.storageKey,
    bucket: record.bucket,
    metadata,
    status:
      record.status === 'DELETED' || record.deletedAt
        ? MediaStatus.DELETED
        : record.status === 'PENDING'
          ? MediaStatus.PENDING
          : MediaStatus.ACTIVE,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (record.thumbnailKey) media.thumbnailKey = record.thumbnailKey;
  if (record.compressedKey) media.compressedKey = record.compressedKey;
  if (record.ownerUserId) media.uploadedBy = record.ownerUserId;
  if (record.tenantId) media.tenantId = record.tenantId;
  if (record.deletedAt) media.deletedAt = record.deletedAt;

  return media;
}

export class MediaRepository implements MediaRepositoryInterface {
  readonly name = 'MediaRepository';

  async create(data: CreateMediaRecordInput): Promise<Media> {
    const fileCategory = PURPOSE_TO_CATEGORY[data.metadata.purpose] ?? 'GENERAL';

    const record = await getPrisma().uploadedFile.create({
      data: {
        fileId: data.fileId,
        ownerUserId: data.uploadedBy ?? null,
        context: data.context,
        bucket: data.bucket,
        storageKey: data.objectKey,
        originalName: data.metadata.originalName,
        mimeType: data.metadata.mimeType,
        sizeBytes: data.metadata.size,
        fileCategory,
        checksum: data.metadata.checksum,
        width: data.metadata.width ?? null,
        height: data.metadata.height ?? null,
        thumbnailKey: data.thumbnailKey ?? null,
        compressedKey: data.compressedKey ?? null,
        metadata: data.metadata as unknown as Prisma.InputJsonValue,
        tenantId: data.tenantId ?? null,
        status: 'ACTIVE',
      },
    });

    return mapRecord(record);
  }

  async findById(_id: string): Promise<Media | null> {
    const record = await getPrisma().uploadedFile.findFirst({
      where: { id: _id, ...activeOnly },
    });
    return record ? mapRecord(record) : null;
  }

  async findByFileId(fileId: string): Promise<Media | null> {
    const record = await getPrisma().uploadedFile.findFirst({
      where: { fileId, ...activeOnly },
    });
    return record ? mapRecord(record) : null;
  }

  async softDelete(id: string): Promise<Media> {
    const record = await getPrisma().uploadedFile.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });
    return mapRecord(record);
  }

  async findByUploader(uploadedBy: string, limit = 50): Promise<Media[]> {
    const records = await getPrisma().uploadedFile.findMany({
      where: {
        ownerUserId: uploadedBy,
        status: 'ACTIVE',
        ...activeOnly,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map(mapRecord);
  }
}
