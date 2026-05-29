import { getAiEscalationDisclosureForMobile } from '@/lib/ai-escalation-disclosure/ai-escalation-disclosure.service';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const disclosure = await getAiEscalationDisclosureForMobile();
    return jsonOk({ disclosure });
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load AI escalation disclosure', 500);
  }
}
