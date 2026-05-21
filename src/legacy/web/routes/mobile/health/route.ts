import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonOk({
      scope: "mobile",
      database: "up",
    });
  } catch {
    return jsonError(
      "DATABASE_UNAVAILABLE",
      "Could not reach PostgreSQL. Check DATABASE_URL.",
      503,
    );
  }
}
