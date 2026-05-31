import { jsonError, jsonOk } from '@/lib/api-response';
import { getFeedIngredientAdminService } from '../../../../../../../../../modules/ai/feed/admin/index.js';
import { requireFeedAdmin } from '../../../feed-admin-route.util.js';

type Params = { entityId: string };

export async function GET(_request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.view');
  if (!auth.ok) return auth.response;

  try {
    const data = await getFeedIngredientAdminService().getVersionHistory(
      context.params.entityId,
    );
    return jsonOk({ items: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Version history failed';
    return jsonError('FEED_ADMIN_ERROR', message, 500);
  }
}
