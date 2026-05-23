import { createHash, randomUUID } from 'node:crypto';

import { MobileUploadPurpose, UploadedFileStatus } from '../../generated/prisma/index.js';
import { publicMobileAssetBaseUrl } from '../../legacy/web/lib/mobile-api/public-base-url.js';
import { prisma } from '../../legacy/web/lib/prisma.js';
import { isDangerousExtension, isDangerousMime, sniffMimeFromBuffer } from '../../legacy/web/lib/storage/mime-sniff.js';
import { putObjectBytes } from '../../legacy/web/lib/storage/s3-client.js';
import { getStorageEnv, isS3Configured } from '../../legacy/web/lib/storage/storage-env.js';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const REJECTED_MIMES = new Set(['image/gif', 'image/svg+xml', 'image/svg']);

export type ProfileMediaKind = 'avatar' | 'cover';

export type ProcessedProfileMedia = {
  mainBuffer: Buffer;
  mainMime: string;
  mainWidth: number;
  mainHeight: number;
  thumbBuffer: Buffer;
  thumbMime: string;
  thumbWidth: number;
  thumbHeight: number;
};

export type ProfileMediaUploadResult =
  | {
      ok: true;
      mainFileId: string;
      thumbFileId: string;
      profileImageUrl: string;
      profileThumbUrl: string;
      coverImageUrl: string;
      coverThumbUrl: string;
      mainBytes: number;
      thumbBytes: number;
    }
  | { ok: 'STORAGE_DISABLED' }
  | { ok: 'STORAGE_NOT_CONFIGURED' }
  | { ok: 'FILE_TOO_LARGE' }
  | { ok: 'INVALID_TYPE' }
  | { ok: 'DANGEROUS_FILE' };

function storageKeyFor(kind: ProfileMediaKind, userId: string, variant: 'main' | 'thumb'): string {
  const stamp = Date.now();
  const rand = randomUUID().slice(0, 8);
  const base = `${userId}_${stamp}_${rand}.webp`;
  if (kind === 'avatar') {
    return variant === 'main' ? `users/avatar/${base}` : `users/avatar/thumb/${base}`;
  }
  return variant === 'main' ? `users/cover/${base}` : `users/cover/thumb/${base}`;
}

export async function processProfileMediaBuffer(
  buffer: Buffer,
  kind: ProfileMediaKind,
): Promise<ProcessedProfileMedia | 'INVALID_TYPE'> {
  const sniffed = sniffMimeFromBuffer(buffer);
  if (!sniffed || REJECTED_MIMES.has(sniffed)) return 'INVALID_TYPE';
  if (!sniffed.startsWith('image/')) return 'INVALID_TYPE';

  const sharpMod = await import('sharp');
  const sharp = sharpMod.default;
  const rotated = sharp(buffer).rotate();

  if (kind === 'avatar') {
    const main = await rotated
      .clone()
      .resize(800, 800, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(main.data)
      .resize(200, 200, { fit: 'cover', position: 'centre' })
      .webp({ quality: 78, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return {
      mainBuffer: main.data,
      mainMime: 'image/webp',
      mainWidth: main.info.width ?? 800,
      mainHeight: main.info.height ?? 800,
      thumbBuffer: thumb.data,
      thumbMime: 'image/webp',
      thumbWidth: thumb.info.width ?? 200,
      thumbHeight: thumb.info.height ?? 200,
    };
  }

  const main = await rotated
    .clone()
    .resize(1600, 900, { fit: 'cover', position: 'centre' })
    .webp({ quality: 80, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(main.data)
    .resize(640, 360, { fit: 'cover', position: 'centre' })
    .webp({ quality: 76, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return {
    mainBuffer: main.data,
    mainMime: 'image/webp',
    mainWidth: main.info.width ?? 1600,
    mainHeight: main.info.height ?? 900,
    thumbBuffer: thumb.data,
    thumbMime: 'image/webp',
    thumbWidth: thumb.info.width ?? 640,
    thumbHeight: thumb.info.height ?? 360,
  };
}

async function persistObject(params: {
  ownerUserId: string;
  purpose: MobileUploadPurpose;
  storageKey: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  width: number;
  height: number;
}): Promise<string> {
  const env = getStorageEnv();
  await putObjectBytes({
    env,
    key: params.storageKey,
    body: params.buffer,
    contentType: params.mimeType,
  });
  console.info(
    '[MEDIA_STORAGE]',
    JSON.stringify({
      ok: true,
      key: params.storageKey,
      bucket: env.bucket,
      bytes: params.buffer.length,
    }),
  );
  const checksum = createHash('sha256').update(params.buffer).digest('hex');
  const row = await prisma.uploadedFile.create({
    data: {
      ownerUserId: params.ownerUserId,
      bucket: env.bucket,
      storageKey: params.storageKey,
      originalName: params.originalName.slice(0, 240),
      mimeType: params.mimeType,
      sizeBytes: params.buffer.length,
      fileCategory: params.purpose,
      checksum,
      width: params.width,
      height: params.height,
      status: UploadedFileStatus.ACTIVE,
    },
  });
  return row.id;
}

export async function ingestProfileMedia(params: {
  request: Request;
  ownerUserId: string;
  customerProfileId: string;
  kind: ProfileMediaKind;
  originalName: string;
  declaredMime: string | null;
  fileBuffer: Buffer;
}): Promise<ProfileMediaUploadResult> {
  const env = getStorageEnv();
  if (env.driver === 'disabled') return { ok: 'STORAGE_DISABLED' };
  if (!isS3Configured(env)) return { ok: 'STORAGE_NOT_CONFIGURED' };
  if (params.fileBuffer.length > MAX_INPUT_BYTES) return { ok: 'FILE_TOO_LARGE' };
  if (isDangerousExtension(params.originalName)) return { ok: 'DANGEROUS_FILE' };

  const sniffed = sniffMimeFromBuffer(params.fileBuffer);
  if (!sniffed || isDangerousMime(sniffed) || REJECTED_MIMES.has(sniffed)) {
    return { ok: 'INVALID_TYPE' };
  }

  const declared = params.declaredMime?.trim().toLowerCase() || null;
  if (declared && declared !== sniffed && declared !== 'application/octet-stream') {
    return { ok: 'INVALID_TYPE' };
  }

  const processed = await processProfileMediaBuffer(params.fileBuffer, params.kind);
  if (processed === 'INVALID_TYPE') return { ok: 'INVALID_TYPE' };

  const purpose =
    params.kind === 'avatar'
      ? MobileUploadPurpose.CUSTOMER_PROFILE_PHOTO
      : MobileUploadPurpose.CUSTOMER_COVER_IMAGE;

  const mainKey = storageKeyFor(params.kind, params.ownerUserId, 'main');
  const thumbKey = storageKeyFor(params.kind, params.ownerUserId, 'thumb');

  const mainFileId = await persistObject({
    ownerUserId: params.ownerUserId,
    purpose,
    storageKey: mainKey,
    buffer: processed.mainBuffer,
    mimeType: processed.mainMime,
    originalName: params.originalName,
    width: processed.mainWidth,
    height: processed.mainHeight,
  });

  const thumbFileId = await persistObject({
    ownerUserId: params.ownerUserId,
    purpose,
    storageKey: thumbKey,
    buffer: processed.thumbBuffer,
    mimeType: processed.thumbMime,
    originalName: `thumb-${params.originalName}`,
    width: processed.thumbWidth,
    height: processed.thumbHeight,
  });

  const base = publicMobileAssetBaseUrl(params.request);
  const mainUrl = `${base}/api/mobile/uploads/${mainFileId}`;
  const thumbUrl = `${base}/api/mobile/uploads/${thumbFileId}`;

  if (params.kind === 'avatar') {
    await prisma.customerProfile.update({
      where: { id: params.customerProfileId },
      data: {
        profilePhotoUrl: mainUrl,
        profilePhotoThumbUrl: thumbUrl,
      },
    });
  } else {
    await prisma.customerProfile.update({
      where: { id: params.customerProfileId },
      data: {
        coverPhotoUrl: mainUrl,
        coverPhotoThumbUrl: thumbUrl,
      },
    });
  }

  const cp = await prisma.customerProfile.findUnique({
    where: { id: params.customerProfileId },
    select: {
      profilePhotoUrl: true,
      profilePhotoThumbUrl: true,
      coverPhotoUrl: true,
      coverPhotoThumbUrl: true,
    },
  });

  return {
    ok: true,
    mainFileId,
    thumbFileId,
    profileImageUrl: cp?.profilePhotoUrl ?? mainUrl,
    profileThumbUrl: cp?.profilePhotoThumbUrl ?? thumbUrl,
    coverImageUrl: cp?.coverPhotoUrl ?? '',
    coverThumbUrl: cp?.coverPhotoThumbUrl ?? '',
    mainBytes: processed.mainBuffer.length,
    thumbBytes: processed.thumbBuffer.length,
  };
}

export async function clearProfileMedia(params: {
  customerProfileId: string;
  kind: ProfileMediaKind;
}): Promise<void> {
  if (params.kind === 'avatar') {
    await prisma.customerProfile.update({
      where: { id: params.customerProfileId },
      data: { profilePhotoUrl: null, profilePhotoThumbUrl: null },
    });
    return;
  }
  await prisma.customerProfile.update({
    where: { id: params.customerProfileId },
    data: { coverPhotoUrl: null, coverPhotoThumbUrl: null },
  });
}
