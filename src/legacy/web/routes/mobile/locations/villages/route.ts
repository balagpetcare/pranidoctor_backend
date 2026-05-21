import { jsonError, jsonOk } from "@/lib/api-response";
import { listVillagesForMobile } from "@/lib/mobile-locations/locations-service";
import { listVillagesQuerySchema } from "@/lib/mobile-locations/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = { unionId: url.searchParams.get("unionId") ?? undefined };
  const parsed = listVillagesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "অনুরোধের প্যারামিটার সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }
  try {
    const items = await listVillagesForMobile(parsed.data);
    return jsonOk({ items });
  } catch {
    return jsonError("DATABASE_ERROR", "গ্রামের তালিকা লোড করা যায়নি", 500);
  }
}
