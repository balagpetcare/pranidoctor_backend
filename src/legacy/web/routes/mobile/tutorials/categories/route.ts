import { jsonError, jsonOk } from "@/lib/api-response";
import { listActiveTutorialCategories } from "@/lib/knowledge-hub/service";

/** Public Knowledge Hub categories for mobile (no auth). */
export async function GET() {
  try {
    const categories = await listActiveTutorialCategories();
    return jsonOk({ categories });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load categories", 500);
  }
}
