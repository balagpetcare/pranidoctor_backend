import { jsonError, jsonOk } from "@/lib/api-response";
import { listUpazilasForMobile } from "@/lib/mobile-locations/locations-service";
import { listUpazilasQuerySchema } from "@/lib/mobile-locations/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = {
    districtId: url.searchParams.get("districtId") ?? undefined,
  };
  const parsed = listUpazilasQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "অনুরোধের প্যারামিটার সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const items = await listUpazilasForMobile(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "উপজেলার তালিকা লোড করা যায়নি", 500);
  }
}
