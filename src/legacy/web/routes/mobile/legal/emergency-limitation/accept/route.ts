import { syncMobileSettingsForUser } from '@/lib/mobile-settings/mobile-settings-service.js';
import { loadLegalConfig } from '@/lib/mobile-settings/legal-config.js';
import { emergencyLimitationAcceptBodySchema } from '@/lib/emergency-limitation/schemas.js';
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

  const parsed = emergencyLimitationAcceptBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid body', 422, parsed.error.flatten());
  }

  const legal = await loadLegalConfig();
  if (parsed.data.version !== legal.emergencyLimitationVersion) {
    return jsonError('VALIDATION_ERROR', 'Limitation notice version mismatch', 409, {
      expectedVersion: legal.emergencyLimitationVersion,
    });
  }

  try {
    const result = await syncMobileSettingsForUser(
      auth.ctx.userId,
      {
        acceptEmergencyVersion: parsed.data.version,
        acceptEmergencySurface: parsed.data.surface,
        acceptEmergencyServiceRequestId: parsed.data.serviceRequestId,
      },
      request,
    );

    return jsonOk(result);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not record emergency limitation acceptance', 500);
  }
}
