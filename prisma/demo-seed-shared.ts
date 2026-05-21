/**
 * Stable identifiers for Prani Doctor demo seed + reset.
 * Reset deletes **only** rows tied to these ids / emails — never arbitrary production data.
 */

export const DEMO_CUSTOMER_EMAIL = "customer@pranidoctor.test";
export const DEMO_CUSTOMER_PHONE = "8801701022274";

export const DEMO_USER_EMAILS = [
  DEMO_CUSTOMER_EMAIL,
  "demo-doctor-1@pranidoctor.test",
  "demo-doctor-2@pranidoctor.test",
  "demo-doctor-3@pranidoctor.test",
  "demo-doctor-4@pranidoctor.test",
  "demo-doctor-5@pranidoctor.test",
  "demo-ai-1@pranidoctor.test",
  "demo-ai-2@pranidoctor.test",
  "demo-ai-3@pranidoctor.test",
  "demo-support@pranidoctor.test",
] as const;

export const DEMO_SERVICE_REQUEST_IDS = [
  "demo-seed-sr-01-pending",
  "demo-seed-sr-02-assigned",
  "demo-seed-sr-03-accepted",
  "demo-seed-sr-04-progress",
  "demo-seed-sr-05-completed",
  "demo-seed-sr-06-cancelled",
  "demo-seed-sr-07-ai",
  "demo-seed-sr-08-online",
] as const;

export const DEMO_ANIMAL_IDS = [
  "demo-seed-animal-1",
  "demo-seed-animal-2",
  "demo-seed-animal-3",
  "demo-seed-animal-4",
  "demo-seed-animal-5",
  "demo-seed-animal-6",
] as const;

export const DEMO_NOTIFICATION_IDS = [
  "demo-seed-notif-1",
  "demo-seed-notif-2",
  "demo-seed-notif-3",
  "demo-seed-notif-4",
  "demo-seed-notif-5",
  "demo-seed-notif-6",
  "demo-seed-notif-7",
] as const;

export const DEMO_BILLING_IDS = ["demo-seed-bill-paid", "demo-seed-bill-unpaid"] as const;

export const DEMO_PAYMENT_IDS = ["demo-seed-payment-paid"] as const;
