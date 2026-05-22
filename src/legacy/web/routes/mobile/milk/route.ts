import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createMilkForCustomer,
  listMilkForCustomer,
} from "@/lib/mobile-milk/milk-service";
import {
  createMilkBodySchema,
  listMilkQuerySchema,
} from "@/lib/mobile-milk/schemas";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listMilkQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    animalId: url.searchParams.get("animalId") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await listMilkForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load milk records", 500);
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

  const parsed = createMilkBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid milk payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const record = await createMilkForCustomer(
      auth.ctx.customerProfileId,
      parsed.data,
    );
    return jsonOk({ record }, { status: 201 });
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
    return jsonError("DATABASE_ERROR", "Could not create milk record", 500);
  }
}
