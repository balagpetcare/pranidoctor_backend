import { getPrisma } from '../../shared/database/prisma.js';
import { scanText } from './detect.js';
import { guardImageText } from './service.js';

/**
 * Optional OCR. Uses `tesseract.js` (ben+eng) when installed; otherwise returns null
 * and the image is left for manual admin review (see queueImageForReview).
 */
export async function ocrImage(bytes: Uint8Array): Promise<string | null> {
  try {
    const modName = 'tesseract.js';
    const mod = (await import(/* @vite-ignore */ modName)) as {
      recognize: (img: Uint8Array, lang: string) => Promise<{ data: { text: string } }>;
    };
    const r = await mod.recognize(bytes, 'ben+eng');
    return r.data.text ?? '';
  } catch {
    return null;
  }
}

/** Scan an uploaded image; on contact info -> strike + verification removal. Never throws. */
export async function scanUploadedImage(
  userId: string,
  imageUrl: string,
  bytes: Uint8Array,
  ctx: { entityType?: string; entityId?: string } = {},
): Promise<'CLEAN' | 'BLOCKED' | 'UNSCANNED'> {
  try {
    const text = await ocrImage(bytes);
    if (text === null) return 'UNSCANNED';
    const out = await guardImageText(userId, imageUrl, text, ctx);
    return out ? 'BLOCKED' : 'CLEAN';
  } catch {
    return 'UNSCANNED';
  }
}

/** Manual-review queue entry for images that OCR could not read (does not count as a strike). */
export async function queueImageForReview(userId: string, imageUrl: string, ctx: { entityType?: string; entityId?: string } = {}) {
  const db = getPrisma();
  await db.contactViolation.create({
    data: {
      userId,
      source: 'IMAGE',
      field: 'image',
      entityType: ctx.entityType ?? null,
      entityId: ctx.entityId ?? null,
      kinds: [],
      samples: [],
      imageUrl,
      strikeNo: 0,
      status: 'PENDING_REVIEW',
    },
  });
}

export { scanText };
