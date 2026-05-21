import { nanoid } from 'nanoid';

import type { MediaContextType } from './media.types.js';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export function getExtensionFromMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? 'bin';
}

export function generateFileId(): string {
  return nanoid(16);
}

export function buildObjectKey(params: {
  context: MediaContextType;
  fileId: string;
  extension: string;
  variant?: 'original' | 'compressed' | 'thumbnail';
  date?: Date;
}): string {
  const date = params.date ?? new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  const variantSuffix =
    params.variant === 'thumbnail'
      ? '_thumb'
      : params.variant === 'compressed'
        ? '_compressed'
        : '';

  return `uploads/${params.context}/${year}/${month}/${params.fileId}${variantSuffix}.${params.extension}`;
}

export function buildThumbnailKey(originalKey: string): string {
  const lastDot = originalKey.lastIndexOf('.');
  if (lastDot === -1) {
    return `${originalKey}_thumb.webp`;
  }
  const base = originalKey.slice(0, lastDot);
  return `${base}_thumb.webp`;
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  return cleaned.length > 0 ? cleaned : 'file';
}
