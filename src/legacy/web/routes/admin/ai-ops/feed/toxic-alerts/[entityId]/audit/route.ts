import { jsonError, jsonOk } from '@/lib/api-response';
import { listFeedAdminAudit } from '../../../../../../../../../modules/ai/feed/admin/index.js';
import { requireFeedAdmin } from '../../../feed-admin-route.util.js';

type Params = { entityId: string };

export async function GET(request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.audit');
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const items = await listFeedAdminAudit({
      entityId: context.params.entityId,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return jsonOk({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit log failed';
    return jsonError('FEED_ADMIN_ERROR', message, 500);
  }
}
