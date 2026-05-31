import { jsonError, jsonOk } from '@/lib/api-response';
import {
  getFeedIngredientAdminService,
  governanceNotesSchema,
} from '../../../../../../../../../modules/ai/feed/admin/index.js';
import { parseJsonBody, requireFeedAdmin } from '../../../feed-admin-route.util.js';

type Params = { entityId: string };

export async function POST(request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.manage');
  if (!auth.ok) return auth.response;

  const json = await parseJsonBody(request);
  if (json instanceof Response) return json;

  try {
    const body = governanceNotesSchema.parse(json ?? {});
    await getFeedIngredientAdminService().archive(
      context.params.entityId,
      auth.actor.id,
      body.reason,
    );
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Archive failed';
    return jsonError('FEED_ADMIN_ERROR', message, 400);
  }
}
