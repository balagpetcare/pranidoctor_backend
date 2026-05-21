import { z } from "zod";

import {
  ServiceRequestStatus,
  ServiceRequestType,
} from "@/generated/prisma/client";

const serviceTypeSchema = z.nativeEnum(ServiceRequestType);

const listQuerySchema = z.object({
  status: z.nativeEnum(ServiceRequestStatus).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ListServiceRequestsQuery = z.infer<typeof listQuerySchema>;

export function parseListServiceRequestsQuery(searchParams: URLSearchParams) {
  return listQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
}

export const createServiceRequestBodySchema = z
  .object({
    animalId: z.string().min(1),
    serviceCategoryId: z.string().min(1),
    serviceType: serviceTypeSchema,
    problemOrSymptom: z.string().min(1).max(4000),
    description: z.string().max(8000).optional().nullable(),
    areaId: z.string().min(1).optional().nullable(),
    villageId: z.string().min(1).optional().nullable(),
    locationText: z.string().max(4000).optional().nullable(),
    preferredTime: z.string().max(2000).optional().nullable(),
    scheduledStart: z.string().datetime().optional().nullable(),
    scheduledEnd: z.string().datetime().optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const needsGeo =
      data.serviceType === ServiceRequestType.DOCTOR_HOME_VISIT ||
      data.serviceType === ServiceRequestType.EMERGENCY_DOCTOR ||
      data.serviceType === ServiceRequestType.AI_SERVICE;

    const hasGeo =
      Boolean(data.areaId?.trim()) ||
      Boolean(data.villageId?.trim()) ||
      Boolean(data.locationText?.trim());

    if (needsGeo && !hasGeo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide areaId, villageId, or locationText for this service type",
        path: ["areaId"],
      });
    }

    if (data.serviceType === ServiceRequestType.ONLINE_CONSULTATION_LATER) {
      if (!data.preferredTime?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "preferredTime is required for ONLINE_CONSULTATION_LATER",
          path: ["preferredTime"],
        });
      }
    }
  });

export type CreateServiceRequestBody = z.infer<
  typeof createServiceRequestBodySchema
>;

export const cancelServiceRequestBodySchema = z.object({
  cancelReason: z.string().max(2000).optional().nullable(),
});

export type CancelServiceRequestBody = z.infer<
  typeof cancelServiceRequestBodySchema
>;
