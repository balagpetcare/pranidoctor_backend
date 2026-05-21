import { jsonError, jsonOk } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

/**
 * Public ops probe: app identity + PostgreSQL connectivity. No secrets or env values.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonOk({
      service: "pranidoctor-web",
      status: "ok",
      database: "up",
    });
  } catch {
    return jsonError(
      "db_unavailable",
      "Database unreachable",
      503,
    );
  }
}
