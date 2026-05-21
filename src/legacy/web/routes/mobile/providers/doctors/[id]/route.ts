import { jsonError, jsonOk } from "@/lib/api-response";
import { getDoctorDetailForMobile } from "@/lib/mobile-providers/provider-service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;

  try {
    const doctor = await getDoctorDetailForMobile(id);
    if (!doctor) {
      return jsonError("NOT_FOUND", "Doctor not found", 404);
    }
    return jsonOk({ doctor });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load doctor", 500);
  }
}
