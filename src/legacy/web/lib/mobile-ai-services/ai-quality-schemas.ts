import { z } from "zod";

import { AiTechnicianComplaintStatus } from "@/generated/prisma/client";

export const postAiTechnicianReviewBodySchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(4000).optional().nullable(),
  })
  .strict();

export type PostAiTechnicianReviewBody = z.infer<
  typeof postAiTechnicianReviewBodySchema
>;

export const postAiTechnicianComplaintBodySchema = z
  .object({
    category: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(8000),
  })
  .strict();

export type PostAiTechnicianComplaintBody = z.infer<
  typeof postAiTechnicianComplaintBodySchema
>;

export const adminListAiTechnicianComplaintsQuerySchema = z
  .object({
    status: z.nativeEnum(AiTechnicianComplaintStatus).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export const adminUpdateAiTechnicianComplaintBodySchema = z
  .object({
    status: z.nativeEnum(AiTechnicianComplaintStatus),
    adminNote: z.string().trim().max(4000).optional().nullable(),
  })
  .strict();
