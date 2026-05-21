import { jsonError, jsonOk } from "@/lib/api-response";
import { listAiServiceTechniciansPublic } from "@/lib/mobile-ai-services/ai-services-service";
import { listAiServiceTechniciansQuerySchema } from "@/lib/mobile-ai-services/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = listAiServiceTechniciansQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "তথ্য সঠিক নয়",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await listAiServiceTechniciansPublic(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "তালিকা লোড করা যায়নি", 500);
  }
}
