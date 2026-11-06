import { z } from 'zod';

import { requireAdminPanelApiAccess } from '../../../legacy/web/lib/admin-auth/api-guard.js';
import { jsonError, jsonOk } from '../../../legacy/web/lib/api-response.js';
import { isPartnerRole } from '../../partner-auth/partner-roles.js';
import {
  REVIEW_BUCKETS,
  noteRequired,
  type ReviewAction,
} from '../../partner-auth/partner-review.rules.js';
import { isTrackKey } from '../../partner-auth/doctor-tracks.rules.js';
import { decideTrack } from '../../partner-auth/doctor-tracks.service.js';
import { decideDocument } from '../../partner-auth/partner-documents.service.js';
import {
  decidePartnerApplication,
  getPartnerApplicationDetail,
  listPartnerApplications,
} from '../../partner-auth/partner-review.service.js';

const listSchema = z.object({
  role: z.string().optional(),
  bucket: z.enum(REVIEW_BUCKETS as unknown as [string, ...string[]]).optional(),
  q: z.string().trim().max(100).optional(),
  petPending: z.enum(['1']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/admin/partner-verifications */
export async function handleListPartnerApplications(request: Request): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    role: url.searchParams.get('role') || undefined,
    bucket: url.searchParams.get('bucket') || undefined,
    q: url.searchParams.get('q') || undefined,
    petPending: url.searchParams.get('petPending') || undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success || (parsed.data.role && !isPartnerRole(parsed.data.role))) {
    return jsonError('VALIDATION_ERROR', 'Invalid query parameters', 422);
  }
  const { role, bucket, q, limit, offset, petPending } = parsed.data;
  const data = await listPartnerApplications({
    role: role && isPartnerRole(role) ? role : undefined,
    bucket: bucket as (typeof REVIEW_BUCKETS)[number] | undefined,
    q,
    petPending: petPending === '1' ? true : undefined,
    limit,
    offset,
  });
  return jsonOk(data);
}

const decisionSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'request_changes', 'suspend', 'reactivate']),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

/** POST /api/admin/partner-verifications/:role/:id/decision */
export async function handlePartnerDecision(
  request: Request,
  ctx: { params: Promise<{ role: string; id: string }> },
): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;

  const { role, id } = await ctx.params;
  if (!isPartnerRole(role)) return jsonError('VALIDATION_ERROR', 'Invalid role', 422);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Invalid JSON', 400);
  }
  const parsed = decisionSchema.safeParse(json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'Invalid body', 422);
  const action = parsed.data.action as ReviewAction;
  if (noteRequired(action) && !parsed.data.note) {
    return jsonError('NOTE_REQUIRED', 'কারণ বা নির্দেশনা লিখুন।', 422);
  }

  const result = await decidePartnerApplication({
    role,
    profileId: id,
    action,
    note: parsed.data.note,
  });
  if (!result.ok) return jsonError('REVIEW_FAILED', result.message, result.httpStatus);
  return jsonOk({ done: true });
}

/** GET /api/admin/partner-verifications/:role/:id */
export async function handlePartnerDetail(
  request: Request,
  ctx: { params: Promise<{ role: string; id: string }> },
): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  const { role, id } = await ctx.params;
  if (!isPartnerRole(role)) return jsonError('VALIDATION_ERROR', 'Invalid role', 422);
  const detail = await getPartnerApplicationDetail(role, id);
  if (!detail) return jsonError('NOT_FOUND', 'আবেদন পাওয়া যায়নি।', 404);
  return jsonOk(detail);
}

const docDecisionSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

/** POST /api/admin/partner-documents/:docId/decision */
export async function handlePartnerDocumentDecision(
  request: Request,
  ctx: { params: Promise<{ docId: string }> },
): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  const { docId } = await ctx.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Invalid JSON', 400);
  }
  const parsed = docDecisionSchema.safeParse(json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'Invalid body', 422);
  if (parsed.data.action === 'reject' && !parsed.data.note) {
    return jsonError('NOTE_REQUIRED', 'বাতিলের কারণ লিখুন।', 422);
  }
  const result = await decideDocument({ docId, ...parsed.data });
  if (!result.ok) return jsonError(result.code, result.message, result.httpStatus);
  return jsonOk({ done: true });
}

/** POST /api/admin/partner-verifications/DOCTOR/:id/tracks/:kind/decision */
export async function handleTrackDecision(
  request: Request,
  ctx: { params: Promise<{ id: string; kind: string }> },
): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  const { id, kind } = await ctx.params;
  if (!isTrackKey(kind)) return jsonError('VALIDATION_ERROR', 'Invalid track', 422);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Invalid JSON', 400);
  }
  const parsed = decisionSchema.safeParse(json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'Invalid body', 422);
  const action = parsed.data.action as ReviewAction;
  if (noteRequired(action) && !parsed.data.note) {
    return jsonError('NOTE_REQUIRED', 'কারণ বা নির্দেশনা লিখুন।', 422);
  }
  const result = await decideTrack({ doctorProfileId: id, kind, action, note: parsed.data.note });
  if (!result.ok) return jsonError('TRACK_FAILED', result.message, result.httpStatus);
  return jsonOk({ done: true });
}
