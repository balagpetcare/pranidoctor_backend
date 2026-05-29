import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createServiceRequestBodySchema,
  parseListServiceRequestsQuery,
} from "@/lib/mobile-service-requests/schemas";
import {
  createServiceRequestForCustomer,
  listServiceRequestsForCustomer,
} from "@/lib/mobile-service-requests/service-request-service";
import { ServiceRequestType } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app.error.js";
import {
  resolveServiceRequestDisclaimer,
  serviceTypeToDisclaimerContext,
} from "@/lib/vet-disclaimer/vet-disclaimer.service";
import {
  resolveServiceRequestLimitationNotice,
  serviceTypeToLimitationContext,
} from "@/lib/emergency-limitation/emergency-limitation.service.js";
import { assertVetDisclaimerForConsultationBooking } from "../../../../../modules/vet-disclaimer/vet-disclaimer-guard.js";
import { assertEmergencyLimitationForEmergencyBooking } from "../../../../../modules/emergency-limitation/emergency-limitation-guard.js";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = parseListServiceRequestsQuery(url.searchParams);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  const limit = parsed.data.limit ?? 20;
  const offset = parsed.data.offset ?? 0;

  try {
    const data = await listServiceRequestsForCustomer(
      auth.ctx.customerProfileId,
      {
        status: parsed.data.status,
        limit,
        offset,
      },
    );
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load service requests", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createServiceRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid service request payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    await assertVetDisclaimerForConsultationBooking(
      auth.ctx.userId,
      parsed.data.serviceType as ServiceRequestType,
    );
    await assertEmergencyLimitationForEmergencyBooking(
      auth.ctx.userId,
      parsed.data.serviceType as ServiceRequestType,
    );

    const result = await createServiceRequestForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );

    if (result.ok === "NOT_FOUND_ANIMAL") {
      return jsonError(
        "NOT_FOUND",
        "Animal not found or not available for this account",
        404,
      );
    }

    if (result.ok === "NOT_FOUND_CATEGORY") {
      return jsonError("NOT_FOUND", "Service category not found", 404);
    }

    if (result.ok === "CATEGORY_TYPE_MISMATCH") {
      return jsonError(
        "VALIDATION_ERROR",
        `serviceCategoryId must reference category slug "${result.expectedSlug}" for this serviceType`,
        422,
      );
    }

    if (result.ok === "NOT_FOUND_AREA") {
      return jsonError("NOT_FOUND", "Area not found", 404);
    }

    if (result.ok === "NOT_FOUND_VILLAGE") {
      return jsonError("NOT_FOUND", "Village not found", 404);
    }

    const serviceType = result.request.serviceType as ServiceRequestType;
    return jsonOk(
      {
        request: result.request,
        disclaimer: await resolveServiceRequestDisclaimer(serviceType),
        disclaimerContext: serviceTypeToDisclaimerContext(serviceType),
        limitationNotice: await resolveServiceRequestLimitationNotice(serviceType),
        limitationContext: serviceTypeToLimitationContext(serviceType),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    return jsonError("DATABASE_ERROR", "Could not create service request", 500);
  }
}
