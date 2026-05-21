import { z } from "zod";

import {
  providerAssignedRequestsTabSchema,
  statusesForProviderAssignedRequestsTab,
  type ProviderAssignedRequestsTab,
} from "@/lib/service-requests/provider-assigned-list-tab";

/** Optional rejection note (stored on `ServiceRequest.cancelReason` with a doctor prefix). */
export const doctorRejectRequestBodySchema = z
  .object({
    reason: z.string().max(2000).optional(),
  })
  .transform((v) => ({
    reason: v.reason?.trim() ? v.reason.trim() : undefined,
  }));

export type DoctorRejectRequestBody = z.output<
  typeof doctorRejectRequestBodySchema
>;

export const doctorListTabSchema = providerAssignedRequestsTabSchema;

export type DoctorListTab = ProviderAssignedRequestsTab;

export const doctorListServiceRequestsQuerySchema = z.object({
  tab: doctorListTabSchema.default("new"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type DoctorListServiceRequestsQuery = z.infer<
  typeof doctorListServiceRequestsQuerySchema
>;

export function parseDoctorListServiceRequestsQuery(searchParams: URLSearchParams) {
  return doctorListServiceRequestsQuerySchema.safeParse({
    tab: searchParams.get("tab") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
}

/** Status filters per workflow plan (assigned doctor scope applied separately). */
export function statusesForDoctorListTab(tab: DoctorListTab) {
  return statusesForProviderAssignedRequestsTab(tab);
}