import { z } from "zod";

import { ServiceRequestStatus } from "@/generated/prisma/client";

/**
 * Doctor and AI technician assigned-request lists use the same tab semantics
 * (Task Card 12): new = ASSIGNED + ACCEPTED, active = IN_PROGRESS, completed = COMPLETED.
 */
export const providerAssignedRequestsTabSchema = z.enum([
  "new",
  "active",
  "completed",
]);

export type ProviderAssignedRequestsTab = z.infer<
  typeof providerAssignedRequestsTabSchema
>;

export function statusesForProviderAssignedRequestsTab(
  tab: ProviderAssignedRequestsTab,
): ServiceRequestStatus[] {
  switch (tab) {
    case "new":
      return [ServiceRequestStatus.ASSIGNED, ServiceRequestStatus.ACCEPTED];
    case "active":
      return [ServiceRequestStatus.IN_PROGRESS];
    case "completed":
      return [ServiceRequestStatus.COMPLETED];
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}
