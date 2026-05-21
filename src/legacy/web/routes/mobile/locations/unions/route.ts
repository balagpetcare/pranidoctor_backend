import { jsonError, jsonOk } from "@/lib/api-response";
import { listUnionsForMobile } from "@/lib/mobile-locations/locations-service";
import { listUnionsQuerySchema } from "@/lib/mobile-locations/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = {
    districtId: url.searchParams.get("districtId") ?? undefined,
    upazilaId: url.searchParams.get("upazilaId") ?? undefined,
  };
  const parsed = listUnionsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "অনুরোধের প্যারামিটার সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await listUnionsForMobile(parsed.data);
    if (result === "DISTRICT_MISMATCH") {
      return jsonError(
        "LOCATION_MISMATCH",
        "উপজেলাটি নির্বাচিত জেলার অন্তর্গত নয়",
        422,
      );
    }
    return jsonOk({ items: result });
  } catch {
    return jsonError("DATABASE_ERROR", "ইউনিয়নের তালিকা লোড করা যায়নি", 500);
  }
}
