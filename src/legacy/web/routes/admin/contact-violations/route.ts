import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { jsonError, jsonOk } from "@/lib/api-response";
import { listViolations } from "../../../../../modules/contact-guard/service.js";

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;
  const sp = new URL(request.url).searchParams;
  const status = sp.get("status") || undefined;
  const userId = sp.get("userId") || undefined;
  const source = sp.get("source") || undefined;
  const q = sp.get("q") || undefined;
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const take = Math.min(100, Math.max(1, Number(sp.get("limit") ?? "25") || 25));
  try {
    const { rows, total } = await listViolations({ status, userId, source, q, take, skip: (page - 1) * take });
    return jsonOk({ rows, total, page, limit: take });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load contact violations", 500);
  }
}
