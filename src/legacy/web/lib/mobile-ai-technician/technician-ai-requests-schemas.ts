import { z } from "zod";

import { AiPaymentStatus, AnimalType } from "@/generated/prisma/client";

const trimmed = z.string().trim();

export const listTechnicianAiRequestsQuerySchema = z
  .object({
    tab: z
      .enum(["new", "accepted", "ongoing", "completed", "cancelled", "all"])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export type ListTechnicianAiRequestsQuery = z.infer<
  typeof listTechnicianAiRequestsQuerySchema
>;

export const declineAiServiceRequestBodySchema = z
  .object({
    reason: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export type DeclineAiServiceRequestBody = z.infer<
  typeof declineAiServiceRequestBodySchema
>;

export const postAiServiceRequestStatusBodySchema = z
  .object({
    status: z.enum(["ON_THE_WAY", "ARRIVED", "IN_PROGRESS"]),
  })
  .strict();

export type PostAiServiceRequestStatusBody = z.infer<
  typeof postAiServiceRequestStatusBodySchema
>;

const mvpPaymentStatuses = new Set<AiPaymentStatus>([
  AiPaymentStatus.UNPAID,
  AiPaymentStatus.CASH_PAID,
  AiPaymentStatus.MANUAL_PAID,
  AiPaymentStatus.DUE,
]);

export const completeAiServiceRequestBodySchema = z
  .object({
    serviceDate: z.string().datetime(),
    animalType: z.nativeEnum(AnimalType),
    serviceNote: trimmed.min(1).max(8000),
    breedOrSemenType: z.string().trim().max(200).optional().nullable(),
    semenBatch: z.string().trim().max(200).optional().nullable(),
    heatObservation: z.string().trim().max(8000).optional().nullable(),
    inseminationTime: z.string().datetime().optional().nullable(),
    nextFollowUpDate: z.string().datetime().optional().nullable(),
    pregnancyCheckDate: z.string().datetime().optional().nullable(),
    totalFee: z.union([z.number().nonnegative(), z.string().trim().regex(/^\d+(\.\d{1,2})?$/)]).optional().nullable(),
    paymentStatus: z.nativeEnum(AiPaymentStatus).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (
      val.paymentStatus != null &&
      !mvpPaymentStatuses.has(val.paymentStatus)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unsupported payment status for MVP",
        path: ["paymentStatus"],
      });
    }
  });

export type CompleteAiServiceRequestBody = z.infer<
  typeof completeAiServiceRequestBodySchema
>;
