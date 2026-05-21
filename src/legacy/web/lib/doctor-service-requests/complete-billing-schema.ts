import { z } from "zod";

import { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

/** Empty / null → 0 for optional money fields (travel, medicine, discount). */
function nonNegOptionalMoney() {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce.number().finite().min(0),
  );
}

export const doctorCompleteBillingBodySchema = z
  .object({
    serviceFee: z.coerce.number().finite().min(0),
    travelCost: nonNegOptionalMoney().optional(),
    medicineCost: nonNegOptionalMoney().optional(),
    discount: nonNegOptionalMoney().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod),
    paymentStatus: z.nativeEnum(PaymentStatus),
  })
  .transform((v) => ({
    serviceFee: v.serviceFee,
    travelCost: v.travelCost ?? 0,
    medicineCost: v.medicineCost ?? 0,
    discount: v.discount ?? 0,
    paymentMethod: v.paymentMethod,
    paymentStatus: v.paymentStatus,
  }));

export type DoctorCompleteBillingBody = z.infer<
  typeof doctorCompleteBillingBodySchema
>;
