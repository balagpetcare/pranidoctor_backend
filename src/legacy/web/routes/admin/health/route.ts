import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const timestamp = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonOk({
      service: "Prani Doctor Admin API",
      timestamp,
      scope: "admin",
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
