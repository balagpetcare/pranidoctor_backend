import { z } from "zod";

import { AiTechnicianStatus } from "@/generated/prisma/client";

const applicationStatusFilterValues = [
  AiTechnicianStatus.SUBMITTED,
  AiTechnicianStatus.UNDER_REVIEW,
  AiTechnicianStatus.NEEDS_CORRECTION,
  AiTechnicianStatus.APPROVED,
  AiTechnicianStatus.PUBLISHED,
  AiTechnicianStatus.REJECTED,
  AiTechnicianStatus.SUSPENDED,
  AiTechnicianStatus.DRAFT,
] as const;

export const applicationStatusFilterSchema = z.enum(applicationStatusFilterValues);

export const listTechnicianApplicationsQuerySchema = z.object({
  applicationStatus: applicationStatusFilterSchema.optional(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const applicationTransitionActionSchema = z.enum([
  "mark_under_review",
  "request_correction",
  "approve",
  "reject",
  "publish",
  "unpublish",
  "suspend",
  "lift_suspension",
]);

export const applicationTransitionBodySchema = z
  .object({
    action: applicationTransitionActionSchema,
    note: z.string().trim().max(4000).optional().nullable(),
    adminNote: z.string().trim().max(4000).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.action === "request_correction" || data.action === "reject") {
      const n = data.note?.trim();
      if (!n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "note প্রয়োজন",
          path: ["note"],
        });
      }
    }
  });

export type ApplicationTransitionBody = z.infer<
  typeof applicationTransitionBodySchema
>;
