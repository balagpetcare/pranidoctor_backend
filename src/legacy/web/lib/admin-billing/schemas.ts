import { z } from "zod";

import { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

export const adminBillingListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  doctorSearch: z.string().max(200).optional(),
});

export type AdminBillingListQuery = z.infer<typeof adminBillingListQuerySchema>;

export function parseAdminBillingListQuery(searchParams: URLSearchParams) {
  return adminBillingListQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
    paymentStatus: searchParams.get("paymentStatus") ?? undefined,
    paymentMethod: searchParams.get("paymentMethod") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    doctorSearch: searchParams.get("doctorSearch") ?? undefined,
  });
}

/** PUT body: commission as whole percent 0–100 (e.g. 10 = 10%). Stored as fraction 0–1 in Setting. */
export const adminBillingSettingsPutSchema = z.object({
  commissionPercent: z.coerce.number().finite().min(0).max(100),
});

export type AdminBillingSettingsPutBody = z.infer<
  typeof adminBillingSettingsPutSchema
>;
