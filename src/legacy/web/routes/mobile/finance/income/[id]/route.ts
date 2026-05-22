import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  deleteFinanceForCustomer,
  getFinanceForCustomer,
  patchIncomeForCustomer,
} from "@/lib/mobile-finance/finance-service";
import { patchIncomeBodySchema } from "@/lib/mobile-finance/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const record = await getFinanceForCustomer(auth.ctx.customerProfileId, id, "INCOME");
    if (!record) return jsonError("NOT_FOUND", "Income not found", 404);
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load income", 500);
  }
}

export async function PATCH(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = patchIncomeBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid income payload", 422, parsed.error.flatten());
  }

  try {
    const record = await patchIncomeForCustomer(auth.ctx.customerProfileId, id, parsed.data);
    if (!record) return jsonError("NOT_FOUND", "Income not found", 404);
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update income", 500);
  }
}

export async function DELETE(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const deleted = await deleteFinanceForCustomer(auth.ctx.customerProfileId, id, "INCOME");
    if (!deleted) return jsonError("NOT_FOUND", "Income not found", 404);
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not delete income", 500);
  }
}
