import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  createExpenseForCustomer,
  listExpensesForCustomer,
} from "@/lib/mobile-finance/finance-service";
import {
  createExpenseBodySchema,
  listFinanceQuerySchema,
} from "@/lib/mobile-finance/schemas";

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listFinanceQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query parameters", 422, parsed.error.flatten());
  }

  try {
    const result = await listExpensesForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk(result);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load expenses", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createExpenseBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid expense payload", 422, parsed.error.flatten());
  }

  try {
    const record = await createExpenseForCustomer(auth.ctx.customerProfileId, parsed.data);
    return jsonOk({ record }, { status: 201 });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not create expense", 500);
  }
}
