import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const categories = await prisma.serviceCategory.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
    });
    return jsonOk({ categories });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load service categories", 500);
  }
}
