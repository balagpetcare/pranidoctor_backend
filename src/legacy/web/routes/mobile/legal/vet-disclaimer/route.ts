import { getVetDisclaimerForUser } from '@/lib/vet-disclaimer/vet-disclaimer.service';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const disclaimer = await getVetDisclaimerForUser(auth.ctx.userId);
    return jsonOk({ disclaimer });
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load veterinary disclaimer', 500);
  }
}
