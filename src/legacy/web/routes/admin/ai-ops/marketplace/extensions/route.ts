import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../modules/ai/admin/ai-admin.guard.js';
import { getExtensionLoaderService } from '../../../../../../modules/ai/marketplace/extension-loader.service.js';
import { extensionManifestSchema } from '../../../../../../modules/ai/marketplace/marketplace.types.js';

export async function GET() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  try {
    const data = await getExtensionLoaderService().listExtensions();
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list extensions';
    return jsonError('AI_MARKETPLACE_ERROR', message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  try {
    const manifest = extensionManifestSchema.parse(json);
    const data = await getExtensionLoaderService().installExtension(manifest, {
      actorUserId: auth.actor.id,
    });
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to install extension';
    return jsonError('AI_MARKETPLACE_ERROR', message, 400);
  }
}
