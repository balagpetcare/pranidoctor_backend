import { z } from 'zod';

import { MediaContext, MediaPurpose } from './media.types.js';

export const uploadMediaSchema = z.object({
  context: z.enum([
    MediaContext.FARMER,
    MediaContext.DOCTOR,
    MediaContext.AI_TECH,
    MediaContext.ADMIN,
  ]),
  purpose: z.enum([
    MediaPurpose.PROFILE_PHOTO,
    MediaPurpose.COVER_IMAGE,
    MediaPurpose.NID_FRONT,
    MediaPurpose.NID_BACK,
    MediaPurpose.CERTIFICATE,
    MediaPurpose.GALLERY,
    MediaPurpose.DOCUMENT,
    MediaPurpose.MEDICAL_RECORD,
    MediaPurpose.ANIMAL_PHOTO,
    MediaPurpose.GENERAL,
  ]).default(MediaPurpose.GENERAL),
});

export const mediaIdParamSchema = z.object({
  id: z.string().min(1),
});

export const signedUrlQuerySchema = z.object({
  variant: z.enum(['original', 'thumbnail', 'compressed']).default('original'),
  expiresIn: z.coerce.number().int().min(60).max(86400).optional(),
});

export const presignUploadSchema = z.object({
  context: z.enum([
    MediaContext.FARMER,
    MediaContext.DOCTOR,
    MediaContext.AI_TECH,
    MediaContext.ADMIN,
  ]),
  purpose: z.enum([
    MediaPurpose.PROFILE_PHOTO,
    MediaPurpose.COVER_IMAGE,
    MediaPurpose.NID_FRONT,
    MediaPurpose.NID_BACK,
    MediaPurpose.CERTIFICATE,
    MediaPurpose.GALLERY,
    MediaPurpose.DOCUMENT,
    MediaPurpose.MEDICAL_RECORD,
    MediaPurpose.ANIMAL_PHOTO,
    MediaPurpose.GENERAL,
  ]).default(MediaPurpose.GENERAL),
  mimeType: z.string().min(1),
  originalName: z.string().min(1).max(255),
});

export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;
export type MediaIdParam = z.infer<typeof mediaIdParamSchema>;
export type SignedUrlQuery = z.infer<typeof signedUrlQuerySchema>;
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
