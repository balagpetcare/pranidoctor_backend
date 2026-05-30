import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';
import { createSupportTicketForCustomer } from '@/lib/mobile-support/support-service';
import { getClosedBetaConfig } from '../../../../../../shared/launch/closed-beta-config.service.js';
import { betaFeedbackBodySchema } from '../../../../../../shared/launch/closed-beta.schemas.js';

/** Structured closed-beta feedback → support ticket with `[Beta Feedback]` prefix. */
export async function POST(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const config = await getClosedBetaConfig();
  if (!config.feedbackEnabled) {
    return jsonError('FEATURE_DISABLED', 'Beta feedback is not enabled', 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  const parsed = betaFeedbackBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 422);
  }

  const ratingLine =
    parsed.data.rating !== undefined ? `\nRating: ${parsed.data.rating}/5` : '';
  const screenLine = parsed.data.screen ? `\nScreen: ${parsed.data.screen}` : '';
  const localeLine = parsed.data.locale ? `\nLocale: ${parsed.data.locale}` : '';
  const cohortLine =
    config.activeCohort !== 'NONE' ? `\nCohort: ${config.activeCohort}` : '';

  try {
    const ticket = await createSupportTicketForCustomer(
      auth.ctx.customerProfileId,
      auth.ctx.userId,
      {
        category: 'APP_USAGE',
        subject: `[Beta Feedback] ${parsed.data.message.slice(0, 80)}`,
        description: `${parsed.data.message}${ratingLine}${screenLine}${localeLine}${cohortLine}`,
        priority: 'MEDIUM',
      },
      request,
    );
    return jsonOk({ ticketId: ticket.id, status: ticket.status }, { status: 201 });
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not submit beta feedback', 500);
  }
}
