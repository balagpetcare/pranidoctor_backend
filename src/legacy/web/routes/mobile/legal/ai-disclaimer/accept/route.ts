import { loadLegalConfig } from '@/lib/mobile-settings/legal-config.js';
import { syncMobileSettingsForUser } from '@/lib/mobile-settings/mobile-settings-service.js';import { aiDisclaimerAcceptBodySchema } from '@/lib/ai-disclaimer/schemas.js';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';

export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError('VALIDATION_ERROR', 'JSON body required', 400);
  }

  const parsed = aiDisclaimerAcceptBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid body', 422, parsed.error.flatten());
  }

  const legal = await loadLegalConfig();
  if (parsed.data.version !== legal.aiConsentVersion) {
    return jsonError('VALIDATION_ERROR', 'Disclaimer version mismatch', 409, {
      expectedVersion: legal.aiConsentVersion,
    });
  }

  try {
    const result = await syncMobileSettingsForUser(
      auth.ctx.userId,
      { acceptAiVersion: parsed.data.version, acceptAiSurface: parsed.data.surface },
      request,
    );
    return jsonOk(result);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not record AI disclaimer acceptance', 500);
  }
}
