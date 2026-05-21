import sharp from 'sharp';

import { logDebug } from '../../shared/logger/logger.js';

import { buildThumbnailKey, getExtensionFromMime } from './media.folder.js';
import type { ProcessedImage, ThumbnailResult } from './media.types.js';

const COMPRESS_MAX_DIMENSION = 1600;
const COMPRESS_QUALITY = 82;
const THUMBNAIL_SIZE = 320;
const THUMBNAIL_QUALITY = 75;

const RASTER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isRasterImage(mimeType: string): boolean {
  return RASTER_MIMES.has(mimeType);
}

export async function compressImage(
  buffer: Buffer,
  mimeType: string
): Promise<ProcessedImage> {
  if (!isRasterImage(mimeType)) {
    return {
      buffer,
      mimeType,
      extension: getExtensionFromMime(mimeType),
    };
  }

  try {
    const pipeline = sharp(buffer)
      .rotate()
      .resize({
        width: COMPRESS_MAX_DIMENSION,
        height: COMPRESS_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: COMPRESS_QUALITY, effort: 4 });

    const output = await pipeline.toBuffer();
    const meta = await sharp(output).metadata();

    logDebug('Image compressed', {
      originalSize: buffer.length,
      compressedSize: output.length,
      width: meta.width,
      height: meta.height,
    });

    return {
      buffer: output,
      mimeType: 'image/webp',
      width: meta.width,
      height: meta.height,
      extension: 'webp',
    };
  } catch {
    return {
      buffer,
      mimeType,
      extension: getExtensionFromMime(mimeType),
    };
  }
}

export async function generateThumbnail(
  buffer: Buffer,
  originalObjectKey: string
): Promise<ThumbnailResult> {
  const output = await sharp(buffer)
    .rotate()
    .resize({
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  const meta = await sharp(output).metadata();

  return {
    buffer: output,
    mimeType: 'image/webp',
    width: meta.width ?? THUMBNAIL_SIZE,
    height: meta.height ?? THUMBNAIL_SIZE,
    objectKey: buildThumbnailKey(originalObjectKey),
  };
}
