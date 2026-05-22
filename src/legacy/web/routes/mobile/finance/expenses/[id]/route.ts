import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  deleteFinanceForCustomer,
  getFinanceForCustomer,
  patchExpenseForCustomer,
} from "@/lib/mobile-finance/finance-service";
import { patchExpenseBodySchema } from "@/lib/mobile-finance/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const record = await getFinanceForCustomer(auth.ctx.customerProfileId, id, "EXPENSE");
    if (!record) return jsonError("NOT_FOUND", "Expense not found", 404);
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load expense", 500);
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

  const parsed = patchExpenseBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid expense payload", 422, parsed.error.flatten());
  }

  try {
    const record = await patchExpenseForCustomer(auth.ctx.customerProfileId, id, parsed.data);
    if (!record) return jsonError("NOT_FOUND", "Expense not found", 404);
    return jsonOk({ record });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not update expense", 500);
  }
}

export async function DELETE(request: Request, ctx: RouteParams) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const deleted = await deleteFinanceForCustomer(auth.ctx.customerProfileId, id, "EXPENSE");
    if (!deleted) return jsonError("NOT_FOUND", "Expense not found", 404);
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not delete expense", 500);
  }
}
