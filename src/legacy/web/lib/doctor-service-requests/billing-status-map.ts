import {
  BillingStatus,
  PaymentStatus,
} from "@/generated/prisma/client";

/**
 * Maps invoice-level PaymentStatus (MVP + legacy gateway values) to BillingStatus.
 */
export function mapPaymentStatusToBillingStatus(
  ps: PaymentStatus,
): BillingStatus {
  switch (ps) {
    case PaymentStatus.PAID:
      return BillingStatus.PAID;
    case PaymentStatus.PARTIAL:
      return BillingStatus.PARTIALLY_PAID;
    case PaymentStatus.UNPAID:
      return BillingStatus.ISSUED;
    case PaymentStatus.REFUNDED:
      return BillingStatus.REFUNDED;
    case PaymentStatus.CANCELLED:
    case PaymentStatus.FAILED:
      return BillingStatus.VOIDED;
    case PaymentStatus.CAPTURED:
      return BillingStatus.PAID;
    case PaymentStatus.PENDING:
    case PaymentStatus.AUTHORIZED:
      return BillingStatus.ISSUED;
    default:
      return BillingStatus.ISSUED;
  }
}
