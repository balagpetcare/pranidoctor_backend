import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { getAdminSession } from '@/lib/admin-auth/session';
import { getIdentityAuthService } from '@auth/identity-auth.service.js';
import { acceptPanelLegalDocument } from '@/lib/panel-legal/panel-legal.service';
import { panelLegalAcceptBodySchema } from '@/lib/panel-legal/schemas';

export async function POST(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const session = await getAdminSession();
  if (!session) {
    return jsonError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const actor = await getIdentityAuthService().admin.resolveActor(session);
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
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not record acceptance', 500);
  }
}
