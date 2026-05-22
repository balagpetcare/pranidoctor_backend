import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { remindersForCustomer } from "@/lib/mobile-vaccines/vaccine-service";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const reminders = await remindersForCustomer(auth.ctx.customerProfileId);
    return jsonOk({ reminders });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load vaccine reminders", 500);
  }
}
