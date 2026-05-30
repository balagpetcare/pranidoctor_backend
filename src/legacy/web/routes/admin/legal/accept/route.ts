import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { resolveAdminPanelActor } from '@/lib/admin-auth/panel-access';
import { getAdminSession } from '@/lib/admin-auth/session';
import { LegalDocumentNotPublishedError } from '../../../../../../modules/legal/legal-acceptance.service.js';
import { acceptPanelLegalDocument } from '@/lib/panel-legal/panel-legal.service';
import { panelLegalAcceptBodySchema } from '@/lib/panel-legal/schemas';

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;

  const session = await getAdminSession(request);
  if (!session) {
    return jsonError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const actor = await resolveAdminPanelActor(session);
  if (!actor) {
    return jsonError('FORBIDDEN', 'Forbidden', 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }

  const parsed = panelLegalAcceptBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid accept payload', 422, parsed.error.flatten());
  }

  try {
    const status = await acceptPanelLegalDocument({
      userId: actor.id,
      role: actor.role,
      documentKey: parsed.data.documentKey,
      version: parsed.data.version,
      locale: parsed.data.locale,
      request,
      appSurface: 'admin_web',
    });
    return jsonOk(status);
  } catch (error) {
    if (error instanceof LegalDocumentNotPublishedError) {
      return jsonError(
        'LEGAL_DOCUMENT_UNAVAILABLE',
        'Legal policy is not published yet. Contact your platform administrator.',
        503,
      );
    }
    return jsonError('DATABASE_ERROR', 'Could not record acceptance', 500);
  }
}
