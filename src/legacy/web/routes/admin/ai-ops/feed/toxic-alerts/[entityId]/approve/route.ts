import { jsonError, jsonOk } from '@/lib/api-response';
import {
  getFeedToxicAdminService,
  governanceNotesSchema,
} from '../../../../../../../../../modules/ai/feed/admin/index.js';
import { parseJsonBody, requireFeedAdmin } from '../../../feed-admin-route.util.js';

type Params = { entityId: string };

export async function POST(request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.publish');
  if (!auth.ok) return auth.response;

  const json = await parseJsonBody(request);
  if (json instanceof Response) return json;

  try {
    const body = governanceNotesSchema.parse(json ?? {});
    await getFeedToxicAdminService().approve(
      context.params.entityId,
      auth.actor.id,
      body.notes,
    );
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Approve failed';
    return jsonError('FEED_ADMIN_ERROR', message, 400);
  }
}
