import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getFeedToxicAdminService } from '../../../../../../../../../modules/ai/feed/admin/index.js';
import { parseJsonBody, requireFeedAdmin } from '../../../feed-admin-route.util.js';

type Params = { entityId: string };

const reviewSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

export async function POST(request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.manage');
  if (!auth.ok) return auth.response;

  const json = await parseJsonBody(request);
  if (json instanceof Response) return json;

  try {
    const body = reviewSchema.parse(json);
    await getFeedToxicAdminService().review(
      context.params.entityId,
      auth.actor.id,
      body.approved,
      body.notes,
    );
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review failed';
    return jsonError('FEED_ADMIN_ERROR', message, 400);
  }
}
