import { getAiDisclaimerForUser } from '@/lib/ai-disclaimer/ai-disclaimer.service';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const disclaimer = await getAiDisclaimerForUser(auth.ctx.userId);
    return jsonOk({ disclaimer });
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load AI disclaimer', 500);
  }
}
