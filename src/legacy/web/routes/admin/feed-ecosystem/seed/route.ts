import { requireAdminApiActor, requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminGetLastSeedRun,
  adminGetSeedPreview,
  adminRunPhase4FeedSeed,
  adminRunPhase4VendorSeed,
  adminSaveSeedRunReport,
} from "@/lib/admin-feed-ecosystem/seed-management-service";
import { seedRunBodySchema } from "@/lib/admin-feed-ecosystem/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const [preview, lastRun] = await Promise.all([
      adminGetSeedPreview(),
      adminGetLastSeedRun(),
    ]);
    return jsonOk({ preview, lastRun });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load seed preview", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;

  if (auth.actor.role !== "SUPER_ADMIN") {
    return jsonError("FORBIDDEN", "SUPER_ADMIN required to run seed", 403);
  }

  let json: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) json = JSON.parse(text);
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = seedRunBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  const errors: string[] = [];
  let feedItems: { created: number; updated: number } | undefined;
  let vendors: { created: number; updated: number } | undefined;

  try {
    if (parsed.data.target === "feed_items" || parsed.data.target === "all") {
      const result = await adminRunPhase4FeedSeed();
      feedItems = result.feedItems;
      errors.push(...result.errors);
    }
    if (parsed.data.target === "vendors" || parsed.data.target === "all") {
      const result = await adminRunPhase4VendorSeed();
      vendors = result.vendors;
      errors.push(...result.errors);
    }

    const report = {
      ranAt: new Date().toISOString(),
      actorUserId: auth.actor.id,
      ...(feedItems ? { feedItems } : {}),
      ...(vendors ? { vendors } : {}),
      errors,
    };
    await adminSaveSeedRunReport(report);

    return jsonOk({ report });
  } catch (e) {
    return jsonError(
      "SEED_FAILED",
      e instanceof Error ? e.message : "Seed run failed",
      500,
    );
  }
}
