import { z } from "zod";

import {
  AnimalType,
  AnimalWeightMeasurementSource,
  AnimalWeightMethod,
} from "@/generated/prisma/client";

const dateTimeSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date-time string",
  });

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

const optionalNote = z.string().trim().max(2000).optional();
const clientMeasurementId = z.string().trim().max(120).optional();

const tapeCaptureSchema = z
  .object({
    method: z.literal("TAPE"),
    heartGirthCm: z.coerce.number().positive().max(300),
    bodyLengthCm: z.coerce.number().positive().max(300),
    measuredAt: dateTimeSchema.optional(),
    measuredOn: dateOnlySchema.optional(),
    note: optionalNote,
    clientMeasurementId,
  })
  .strict();

const scaleCaptureSchema = z
  .object({
    method: z.literal("SCALE"),
    weightKg: z.coerce.number().positive().max(99999),
    scalePhotoUrl: z.string().trim().url().max(2000).optional(),
    measuredAt: dateTimeSchema.optional(),
    measuredOn: dateOnlySchema.optional(),
    note: optionalNote,
    clientMeasurementId,
  })
  .strict();

const aiCaptureSchema = z
  .object({
    method: z.literal("AI_CAMERA"),
    uploadIds: z.array(z.string().trim().min(1)).min(1).max(5).optional(),
    videoUploadId: z.string().trim().min(1).optional(),
    aiDisclaimerAck: z.literal(true),
    measuredAt: dateTimeSchema.optional(),
    measuredOn: dateOnlySchema.optional(),
    note: optionalNote,
    clientMeasurementId,
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasImages = (data.uploadIds?.length ?? 0) > 0;
    const hasVideo = !!data.videoUploadId;
    if (!hasImages && !hasVideo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one image or video upload is required",
        path: ["uploadIds"],
      });
    }
  });

export const weightCaptureSchema = z.union([
  tapeCaptureSchema,
  scaleCaptureSchema,
  aiCaptureSchema,
]);

export type WeightCaptureBody = z.infer<typeof weightCaptureSchema>;

export const tapePreviewBodySchema = z
  .object({
    animalType: z.nativeEnum(AnimalType),
    heartGirthCm: z.coerce.number().positive().max(300),
    bodyLengthCm: z.coerce.number().positive().max(300),
  })
  .strict();

export const createMeasurementBodySchema = z
  .object({
    weightCapture: weightCaptureSchema,
    source: z.nativeEnum(AnimalWeightMeasurementSource).optional(),
  })
  .strict();

export const listMeasurementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  method: z.nativeEnum(AnimalWeightMethod).optional(),
});

export const createAiJobBodySchema = z
  .object({
    uploadIds: z.array(z.string().trim().min(1)).min(1).max(5).optional(),
    videoUploadId: z.string().trim().min(1).optional(),
    aiDisclaimerAck: z.literal(true),
    clientMeasurementId,
    registrationDraftId: z.string().trim().max(120).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasImages = (data.uploadIds?.length ?? 0) > 0;
    const hasVideo = !!data.videoUploadId;
    if (!hasImages && !hasVideo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one image or video upload is required",
        path: ["uploadIds"],
      });
    }
  });

export type CreateMeasurementBody = z.infer<typeof createMeasurementBodySchema>;
export type TapePreviewBody = z.infer<typeof tapePreviewBodySchema>;
export type ListMeasurementsQuery = z.infer<typeof listMeasurementsQuerySchema>;
export type CreateAiJobBody = z.infer<typeof createAiJobBodySchema>;
