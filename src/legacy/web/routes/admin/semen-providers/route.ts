import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import {
  adminCreateSemenProvider,
  adminListSemenProviders,
} from "@/lib/admin-semen/providers-service";
import {
  createSemenProviderBodySchema,
  listSemenProvidersQuerySchema,
} from "@/lib/admin-semen/schemas";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = listSemenProvidersQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    isActive: url.searchParams.get("isActive") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
  }

  try {
    const isActive =
      parsed.data.isActive === "true"
        ? true
        : parsed.data.isActive === "false"
          ? false
          : undefined;
    const data = await adminListSemenProviders({
      ...parsed.data,
      isActive,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load providers", 500);
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createSemenProviderBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid payload", 422, parsed.error.flatten());
  }

  try {
    const row = await adminCreateSemenProvider(parsed.data);
    return jsonOk({ provider: row }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "LOGO_FILE_NOT_FOUND") {
      return jsonError("LOGO_FILE_NOT_FOUND", "Logo file not found", 422);
    }
    if (e instanceof Error && e.message.includes("Unique")) {
      return jsonError("DUPLICATE", "Slug or logo already in use", 409);
    }
    return jsonError("DATABASE_ERROR", "Could not create provider", 500);
  }
}
