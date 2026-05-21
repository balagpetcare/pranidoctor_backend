import { z } from "zod";

import {
  ServiceRequestStatus,
  ServiceRequestType,
} from "@/generated/prisma/client";

export const adminListServiceRequestsQuerySchema = z.object({
  status: z.nativeEnum(ServiceRequestStatus).optional(),
  serviceType: z.nativeEnum(ServiceRequestType).optional(),
  areaId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type AdminListServiceRequestsQuery = z.infer<
  typeof adminListServiceRequestsQuerySchema
>;

export function parseAdminListServiceRequestsQuery(
  searchParams: URLSearchParams,
) {
  return adminListServiceRequestsQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    serviceType: searchParams.get("serviceType") ?? undefined,
    areaId: searchParams.get("areaId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
}

export const adminAssignDoctorBodySchema = z.object({
  doctorProfileId: z.string().min(1).max(128),
});

export const adminAssignTechnicianBodySchema = z.object({
  aiTechnicianProfileId: z.string().min(1).max(128),
});

export type AdminAssignDoctorBody = z.infer<typeof adminAssignDoctorBodySchema>;
export type AdminAssignTechnicianBody = z.infer<
  typeof adminAssignTechnicianBodySchema
>;
