import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';
import { acceptPanelLegalDocument } from '@/lib/panel-legal/panel-legal.service';
import { panelLegalAcceptBodySchema } from '@/lib/panel-legal/schemas';

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }

  const parsed = panelLegalAcceptBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid accept payload', 422, parsed.error.flatten());
  }

  try {
    const status = await acceptPanelLegalDocument({
      userId: auth.ctx.userId,
      role: 'CUSTOMER',
      documentKey: parsed.data.documentKey,
      version: parsed.data.version,
      locale: parsed.data.locale ?? auth.ctx.profileLocale,
      request,
      appSurface: 'flutter_customer',
    });
    return jsonOk(status);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not record acceptance', 500);
  }
}
