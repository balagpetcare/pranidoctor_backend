import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  deleteMilkForCustomer,
  getMilkForCustomer,
  patchMilkForCustomer,
} from "@/lib/mobile-milk/milk-service";
import { patchMilkBodySchema } from "@/lib/mobile-milk/schemas";
import { Prisma } from "@/generated/prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const record = await getMilkForCustomer(auth.ctx.customerProfileId, id);
    if (!record) {
      return jsonError("NOT_FOUND", "Milk record not found", 404);
    }
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load milk record", 500);
  }
}

export async function PATCH(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchMilkBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid milk payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const record = await patchMilkForCustomer(
      auth.ctx.customerProfileId,
      id,
      parsed.data,
    );
    if (!record) {
      return jsonError("NOT_FOUND", "Milk record not found", 404);
    }
    return jsonOk({ record });
  } catch (e) {
    if (e instanceof Error && e.message === "ANIMAL_NOT_FOUND") {
      return jsonError("NOT_FOUND", "Animal not found", 404);
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(
        "CONFLICT",
        "A milk entry already exists for this animal, date, and session",
        409,
      );
    }
    return jsonError("DATABASE_ERROR", "Could not update milk record", 500);
  }
}

export async function DELETE(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const deleted = await deleteMilkForCustomer(auth.ctx.customerProfileId, id);
    if (!deleted) {
      return jsonError("NOT_FOUND", "Milk record not found", 404);
    }
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not delete milk record", 500);
  }
}
