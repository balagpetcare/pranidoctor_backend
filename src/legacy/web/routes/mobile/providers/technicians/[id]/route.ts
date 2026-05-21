import { jsonError, jsonOk } from "@/lib/api-response";
import { getTechnicianDetailForMobile } from "@/lib/mobile-providers/provider-service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;

  try {
    const technician = await getTechnicianDetailForMobile(id);
    if (!technician) {
      return jsonError("NOT_FOUND", "Technician not found", 404);
    }
    return jsonOk({ technician });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load technician", 500);
  }
}
