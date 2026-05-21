import { describe, expect, it } from "vitest";

import { mapPaymentStatusToBillingStatus } from "@/lib/doctor-service-requests/billing-status-map";
import { BillingStatus, PaymentStatus } from "@/generated/prisma/client";

describe("mapPaymentStatusToBillingStatus", () => {
  it("maps MVP statuses", () => {
    expect(mapPaymentStatusToBillingStatus(PaymentStatus.PAID)).toBe(BillingStatus.PAID);
    expect(mapPaymentStatusToBillingStatus(PaymentStatus.PARTIAL)).toBe(
      BillingStatus.PARTIALLY_PAID,
    );
    expect(mapPaymentStatusToBillingStatus(PaymentStatus.UNPAID)).toBe(BillingStatus.ISSUED);
    expect(mapPaymentStatusToBillingStatus(PaymentStatus.REFUNDED)).toBe(BillingStatus.REFUNDED);
    expect(mapPaymentStatusToBillingStatus(PaymentStatus.CANCELLED)).toBe(BillingStatus.VOIDED);
  });
});
