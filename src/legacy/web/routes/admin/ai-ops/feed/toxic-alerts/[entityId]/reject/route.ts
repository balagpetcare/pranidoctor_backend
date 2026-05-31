import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getFeedToxicAdminService } from '../../../../../../../../../modules/ai/feed/admin/index.js';
import { parseJsonBody, requireFeedAdmin } from '../../../feed-admin-route.util.js';

type Params = { entityId: string };

const rejectSchema = z.object({ reason: z.string().min(1) });

export async function POST(request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.manage');
  if (!auth.ok) return auth.response;

  const json = await parseJsonBody(request);
  if (json instanceof Response) return json;

  try {
    const body = rejectSchema.parse(json);
    await getFeedToxicAdminService().reject(
      context.params.entityId,
      auth.actor.id,
      body.reason,
    );
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reject failed';
    return jsonError('FEED_ADMIN_ERROR', message, 400);
  }
}
