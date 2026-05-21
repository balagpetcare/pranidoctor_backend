import { describe, expect, it } from "vitest";

import { doctorCompleteBillingBodySchema } from "@/lib/doctor-service-requests/complete-billing-schema";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

describe("doctorCompleteBillingBodySchema", () => {
  it("parses minimal payload with optional amounts defaulting", () => {
    const r = doctorCompleteBillingBodySchema.safeParse({
      serviceFee: 500,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.travelCost).toBe(0);
      expect(r.data.medicineCost).toBe(0);
      expect(r.data.discount).toBe(0);
    }
  });

  it("rejects negative serviceFee", () => {
    const r = doctorCompleteBillingBodySchema.safeParse({
      serviceFee: -1,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.UNPAID,
    });
    expect(r.success).toBe(false);
  });
});
