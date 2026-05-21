import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

/** Public catalog — home shortcuts before login. */
export async function GET() {
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
