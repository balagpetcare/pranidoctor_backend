import { requireAdminApiActor } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';
import { tagBetaDoctor } from '../../../../../../../shared/launch/closed-beta-access.service.js';
import { tagBetaDoctorBodySchema } from '../../../../../../../shared/launch/closed-beta.schemas.js';

export async function POST(
  request: Request,
  context?: { params: Promise<Record<string, string>> },
) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== 'SUPER_ADMIN' && auth.actor.role !== 'ADMIN') {
    return jsonError('FORBIDDEN', 'Admin role required', 403);
  }
  const params = await (context?.params ?? Promise.resolve({}));
  const doctorProfileId = params.doctorProfileId?.trim();
  if (!doctorProfileId) {
    return jsonError('VALIDATION_ERROR', 'doctorProfileId required', 422);
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  const parsed = tagBetaDoctorBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 422);
  }
  try {
    const tag = await tagBetaDoctor(doctorProfileId, parsed.data.cohort, {
      note: parsed.data.note,
      acceptsEmergency: parsed.data.acceptsEmergency,
    });
    return jsonOk({ doctorProfileId, tag });
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to tag beta doctor', 500);
  }
}
