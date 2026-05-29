import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  getLivestockController,
  mapLivestockError,
} from "../../../../../../modules/livestock/index.js";

type RouteContext = { params: Promise<{ id: string }> };

const recordWeightSchema = z.object({
  weightKg: z.coerce.number().positive().max(99999),
  note: z.string().trim().max(500).optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(_request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const livestock = await getLivestockController().getById(
      auth.ctx.customerProfileId,
      id,
    );
    const records =
      livestock.weightKg != null
        ? [
            {
              weightKg: livestock.weightKg,
              recordedAt: livestock.lastWeightAt,
            },
          ]
        : [];
    return jsonOk({
      livestockId: id,
      current: {
        weightKg: livestock.weightKg,
        lastWeightAt: livestock.lastWeightAt,
      },
      records,
    });
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not load weight history", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = recordWeightSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid weight payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const livestock = await getLivestockController().update(
      auth.ctx.customerProfileId,
      id,
      { weightKg: parsed.data.weightKg },
      auth.ctx.userId,
    );
    return jsonOk({
      livestockId: id,
      record: {
        weightKg: livestock.weightKg,
        recordedAt: livestock.lastWeightAt,
        note: parsed.data.note ?? null,
      },
      current: {
        weightKg: livestock.weightKg,
        lastWeightAt: livestock.lastWeightAt,
      },
    });
  } catch (e) {
    const mapped = mapLivestockError(e);
    if (mapped) return jsonError(mapped.code, mapped.message, mapped.status);
    return jsonError("DATABASE_ERROR", "Could not record weight", 500);
  }
}
