import { jsonError, jsonOk } from "@/lib/api-response";
import { listDistrictsForMobile } from "@/lib/mobile-locations/locations-service";
import { listDistrictsQuerySchema } from "@/lib/mobile-locations/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = {
    divisionId: url.searchParams.get("divisionId") ?? undefined,
  };
  const parsed = listDistrictsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "অনুরোধের প্যারামিটার সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const items = await listDistrictsForMobile(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "জেলার তালিকা লোড করা যায়নি", 500);
  }
}
