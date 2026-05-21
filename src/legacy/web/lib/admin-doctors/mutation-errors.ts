import type { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";

export function doctorMutationErrorResponse(
  e: unknown,
): NextResponse | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      return jsonError(
        "DUPLICATE_FIELD",
        "Email or phone must be unique",
        409,
        e.meta,
      );
    }
  }

  if (e instanceof Error) {
    switch (e.message) {
      case "INVALID_AREA_IDS":
        return jsonError(
          "INVALID_AREA_IDS",
          "One or more area IDs were not found",
          422,
        );
      case "INVALID_CATEGORY_IDS":
        return jsonError(
          "INVALID_CATEGORY_IDS",
          "One or more service category IDs were not found",
          422,
        );
      case "CANNOT_ACTIVATE_REJECTED":
        return jsonError(
          "INVALID_STATE",
          "Cannot activate a rejected doctor profile",
          422,
        );
      case "INVALID_FEE":
        return jsonError(
          "VALIDATION_ERROR",
          "visitFeeBdt must be a non-negative number",
          422,
        );
      default:
        break;
    }
  }

  return null;
}
