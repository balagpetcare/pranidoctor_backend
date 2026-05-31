import { jsonError, jsonOk } from '@/lib/api-response';
import {
  getFeedIngredientAdminService,
  updateFeedIngredientSchema,
} from '../../../../../../../../modules/ai/feed/admin/index.js';
import { parseJsonBody, requireFeedAdmin } from '../../feed-admin-route.util.js';

type Params = { entityId: string };

export async function GET(_request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.view');
  if (!auth.ok) return auth.response;

  try {
    const data = await getFeedIngredientAdminService().get(context.params.entityId);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Feed ingredient not found';
    return jsonError('FEED_ADMIN_ERROR', message, 404);
  }
}

export async function PATCH(request: Request, context: { params: Params }) {
  const auth = await requireFeedAdmin('ai.feed.manage');
  if (!auth.ok) return auth.response;

  const json = await parseJsonBody(request);
  if (json instanceof Response) return json;

  try {
    const body = updateFeedIngredientSchema.parse(json);
    const data = await getFeedIngredientAdminService().update(
      context.params.entityId,
      body,
      auth.actor.id,
    );
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update feed ingredient';
    return jsonError('FEED_ADMIN_ERROR', message, 400);
  }
}
