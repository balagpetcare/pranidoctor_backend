import { jsonError, jsonOk } from '@/lib/api-response';
import { requireDoctorApiActor } from '@/lib/doctor-auth/api-guard';
import { getPanelLegalStatus } from '@/lib/panel-legal/panel-legal.service';

export async function GET(request: Request) {
  const auth = await requireDoctorApiActor(request);
  if (!auth.ok) return auth.response;

  try {
    const status = await getPanelLegalStatus(auth.actor.userId, 'DOCTOR');
    return jsonOk(status);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load legal status', 500);
  }
}
