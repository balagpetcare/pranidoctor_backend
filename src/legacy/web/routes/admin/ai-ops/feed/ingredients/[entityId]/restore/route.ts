import { jsonError, jsonOk } from '@/lib/api-response';
import { getFeedIngredientAdminService } from '../../../../../../../../../modules/ai/feed/admin/index.js';
import { requireFeedAdmin } from '../../../feed-admin-route.util.js';

type Params = { entityId: string };

export async function POST(_request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.manage');
  if (!auth.ok) return auth.response;

  try {
    await getFeedIngredientAdminService().restore(context.params.entityId, auth.actor.id);
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Restore failed';
    return jsonError('FEED_ADMIN_ERROR', message, 400);
  }
}
