import { jsonError, jsonOk } from "@/lib/api-response";
import { listDoctorsForMobile } from "@/lib/mobile-providers/provider-service";
import { listMobileProvidersQuerySchema } from "@/lib/mobile-providers/schemas";

function parseListQuery(request: Request) {
  const url = new URL(request.url);
  return listMobileProvidersQuerySchema.safeParse({
    areaId: url.searchParams.get("areaId") ?? undefined,
    areaSlug: url.searchParams.get("areaSlug") ?? undefined,
    animalType: url.searchParams.get("animalType") ?? undefined,
    homeVisit: url.searchParams.get("homeVisit") ?? undefined,
    emergency: url.searchParams.get("emergency") ?? undefined,
    onlineConsultation: url.searchParams.get("onlineConsultation") ?? undefined,
    serviceCategoryId: url.searchParams.get("serviceCategoryId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
}

/** Public provider discovery — browse doctors before login. */
export async function GET(request: Request) {
  const parsed = parseListQuery(request);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await listDoctorsForMobile(parsed.data);
    if ("error" in result) {
      return jsonError(
        "VALIDATION_ERROR",
        result.error ?? "Invalid request",
        422,
      );
    }
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load doctors", 500);
  }
}
