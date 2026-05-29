import { FeedCategory } from "@/generated/prisma/client";
import { mobileListFeedCatalog } from "@/lib/feed-catalog/mobile-catalog-service";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { z } from "zod";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.nativeEnum(FeedCategory).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const data = await mobileListFeedCatalog({
      q: parsed.data.q,
      category: parsed.data.category,
      limit: parsed.data.limit,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load feed catalog", 500);
  }
}
