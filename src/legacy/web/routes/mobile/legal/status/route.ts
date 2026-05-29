import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';
import { getPanelLegalStatus } from '@/lib/panel-legal/panel-legal.service';

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  try {
    const status = await getPanelLegalStatus(
      auth.ctx.userId,
      'CUSTOMER',
      auth.ctx.profileLocale,
    );
    return jsonOk(status);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load legal status', 500);
  }
}
