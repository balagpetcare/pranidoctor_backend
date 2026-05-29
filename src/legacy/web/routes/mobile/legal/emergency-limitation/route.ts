import { getEmergencyLimitationForUser } from '@/lib/emergency-limitation/emergency-limitation.service.js';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const limitation = await getEmergencyLimitationForUser(auth.ctx.userId);
    return jsonOk({ limitation });
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load emergency limitation notice', 500);
  }
}
