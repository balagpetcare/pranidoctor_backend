import { AnimalType } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileAiTechnicianModuleUser } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { listSemenTemplatesQuerySchema } from "@/lib/mobile-ai-technician/semen-mobile-schemas";
import { listSemenTemplatesForTechnicianCatalog } from "@/lib/mobile-ai-technician/semen-template-catalog-service";

export async function GET(request: Request) {
  const auth = await requireMobileAiTechnicianModuleUser(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listSemenTemplatesQuerySchema.safeParse({
    animalType: url.searchParams.get("animalType") ?? undefined,
    providerId: url.searchParams.get("providerId") ?? undefined,
    breedId: url.searchParams.get("breedId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "তথ্য সঠিক নয়", 422, parsed.error.flatten());
  }

  try {
    const data = await listSemenTemplatesForTechnicianCatalog({
      ...parsed.data,
      animalType: parsed.data.animalType as AnimalType | undefined,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "টেমপ্লেট লোড করা যায়নি", 500);
  }
}
