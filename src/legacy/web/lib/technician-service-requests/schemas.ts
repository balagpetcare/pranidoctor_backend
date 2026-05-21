import { z } from "zod";

import {
  providerAssignedRequestsTabSchema,
  statusesForProviderAssignedRequestsTab,
  type ProviderAssignedRequestsTab,
} from "@/lib/service-requests/provider-assigned-list-tab";

export const technicianListTabSchema = providerAssignedRequestsTabSchema;

export type TechnicianListTab = ProviderAssignedRequestsTab;

export const technicianListServiceRequestsQuerySchema = z.object({
  tab: technicianListTabSchema.default("new"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TechnicianListServiceRequestsQuery = z.infer<
  typeof technicianListServiceRequestsQuerySchema
>;

export function parseTechnicianListServiceRequestsQuery(
  searchParams: URLSearchParams,
) {
  return technicianListServiceRequestsQuerySchema.safeParse({
    tab: searchParams.get("tab") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
}

export function statusesForTechnicianListTab(tab: TechnicianListTab) {
  return statusesForProviderAssignedRequestsTab(tab);
}