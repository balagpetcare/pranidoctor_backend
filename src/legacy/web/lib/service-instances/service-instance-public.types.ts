/**
 * Serializable mirrors of Prisma enums (`UserRole`, `ServiceInstanceStatus`).
 * Use from Client Components and shared DTOs — never import `@/generated/prisma/client` there.
 *
 * Keep values in sync with `prisma/schema.prisma`.
 */

export const UserRoles = {
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
  DOCTOR: "DOCTOR",
  AI_TECHNICIAN: "AI_TECHNICIAN",
  SUPPORT: "SUPPORT",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export const ServiceInstanceStatuses = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  NEEDS_CORRECTION: "NEEDS_CORRECTION",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ServiceInstanceStatus =
  (typeof ServiceInstanceStatuses)[keyof typeof ServiceInstanceStatuses];
