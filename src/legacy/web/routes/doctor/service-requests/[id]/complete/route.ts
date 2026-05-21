import { ServiceRequestStatus } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireDoctorApiActor } from "@/lib/doctor-auth/api-guard";
import {
  doctorCompleteBillingBodySchema,
  type DoctorCompleteBillingBody,
} from "@/lib/doctor-service-requests/complete-billing-schema";
import { completeServiceRequestForDoctor } from "@/lib/doctor-service-requests/doctor-service-request-service";
import { prisma } from "@/lib/prisma";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireDoctorApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  const peek = await prisma.serviceRequest.findFirst({
    where: { id, assignedDoctorId: auth.actor.doctorProfileId },
    select: { status: true },
  });

  const raw = await request.json().catch(() => null);

  let billingInput: DoctorCompleteBillingBody | undefined;

  if (!peek) {
    billingInput = undefined;
  } else if (peek.status !== ServiceRequestStatus.COMPLETED) {
    const parsed = doctorCompleteBillingBodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return jsonError(
        "VALIDATION_ERROR",
        "Invalid billing payload",
        400,
        parsed.error.flatten(),
      );
    }
    billingInput = parsed.data;
  } else {
    billingInput = undefined;
  }

  try {
    const result = await completeServiceRequestForDoctor(
      auth.actor.doctorProfileId,
      id,
      billingInput,
    );

    if (result.ok === "NOT_FOUND") {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }

    if (result.ok === "INVALID_STATUS") {
      return jsonError(
        "INVALID_STATUS",
        "This case cannot be completed in its current state",
        409,
        { status: result.status },
      );
    }

    if (result.ok === "TREATMENT_REQUIRED") {
      return jsonError(
        "TREATMENT_REQUIRED",
        "Add at least one finalized treatment note for this case before completing it.",
        422,
      );
    }

    if (result.ok === "BILLING_REQUIRED") {
      return jsonError(
        "BILLING_REQUIRED",
        "Billing details are required to complete this case.",
        422,
      );
    }

    if (result.ok === "BILLING_EXISTS") {
      return jsonError(
        "BILLING_EXISTS",
        "Billing has already been recorded for this case.",
        409,
      );
    }

    if (result.ok === "COMPLETED") {
      return jsonOk({
        request: result.request,
        billing: result.billing,
        meta: { alreadyCompleted: false },
      });
    }

    return jsonOk({
      request: result.request,
      billing: result.billing,
      meta: { alreadyCompleted: true },
    });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update service request", 500);
  }
}
