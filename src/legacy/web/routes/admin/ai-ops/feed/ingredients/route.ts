import { jsonError, jsonOk } from '@/lib/api-response';
import {
  getFeedIngredientAdminService,
  listFeedIngredientsQuerySchema,
  createFeedIngredientSchema,
} from '../../../../../../../modules/ai/feed/admin/index.js';
import { parseJsonBody, requireFeedAdmin } from '../feed-admin-route.util.js';

export async function GET(request: Request) {
  const auth = await requireFeedAdmin('ai.feed.view');
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const params = listFeedIngredientsQuerySchema.parse({
      search: url.searchParams.get('search') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      bdAvailability: url.searchParams.get('bdAvailability') ?? undefined,
      species: url.searchParams.get('species') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    });
    const data = await getFeedIngredientAdminService().list(params);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list feed ingredients';
    return jsonError('FEED_ADMIN_ERROR', message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireFeedAdmin('ai.feed.manage');
  if (!auth.ok) return auth.response;

  const json = await parseJsonBody(request);
  if (json instanceof Response) return json;

  try {
    const body = createFeedIngredientSchema.parse(json);
    const data = await getFeedIngredientAdminService().create(body, auth.actor.id);
    return jsonOk(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create feed ingredient';
    return jsonError('FEED_ADMIN_ERROR', message, 400);
  }
}
