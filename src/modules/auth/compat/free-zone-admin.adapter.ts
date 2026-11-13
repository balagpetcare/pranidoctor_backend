import { z } from 'zod';

import { requireAdminPanelApiAccess } from '../../../legacy/web/lib/admin-auth/api-guard.js';
import { jsonError, jsonOk } from '../../../legacy/web/lib/api-response.js';
import { adminGetQuestion, adminListQuestions, adminListSlots, adminOverview, adminPoints } from '../../free-zone/admin.service.js';
import { adminReportedComments, adminResolveComment } from '../../free-zone/comment.service.js';
import { getPointValues, savePointValues } from '../../free-zone/free-zone.policy.service.js';
import {
  adminActOnWinner,
  adminCreatePeriod,
  adminEditWinner,
  adminListReviews,
  adminSetReviewStatus,
  adminGetPeriod,
  adminListPeriods,
  adminResolveAppeal,
  adminSetStatus,
  type RwResult,
} from '../../free-zone/reward.service.js';

type Ctx = { params: Promise<{ id: string }> };
type WinnerCtx = { params: Promise<{ id: string; wid: string }> };

function respond<T>(r: RwResult<T>): Response {
  return r.ok ? jsonOk(r.data) : jsonError(r.code, r.message, r.httpStatus);
}
async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
const bad = () => jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);

const pointsSchema = z
  .object({
    FREE_CONSULTATION_COMPLETED: z.number().int().min(0).max(1000),
    FIVE_STAR_RATING: z.number().int().min(0).max(1000),
  })
  .strict();

/** GET /api/admin/free-zone-points */
export async function handleGetPoints(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  return jsonOk(await getPointValues());
}

/** PUT /api/admin/free-zone-points */
export async function handlePutPoints(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const p = pointsSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return jsonOk(await savePointValues(p.data));
}

/** GET /api/admin/free-zone-rewards */
export async function handleListPeriods(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  return jsonOk(await adminListPeriods());
}

const createSchema = z
  .object({
    title: z.string().min(1).max(120),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    topN: z.number().int().min(1).max(20),
    minPoints: z.number().int().min(1).max(100000),
    note: z.string().max(500).optional(),
    prizes: z
      .array(z.object({ rank: z.number().int(), title: z.string().min(1).max(120), description: z.string().max(300).optional() }).strict())
      .max(20),
  })
  .strict();

/** POST /api/admin/free-zone-rewards */
export async function handleCreatePeriod(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const p = createSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await adminCreatePeriod(p.data));
}

/** GET /api/admin/free-zone-rewards/:id */
export async function handleGetPeriod(request: Request, ctx: Ctx): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  return respond(await adminGetPeriod((await ctx.params).id));
}

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'CLOSED']) }).strict();

/** PATCH /api/admin/free-zone-rewards/:id  { status } — activate or close (computes winners). */
export async function handleSetPeriodStatus(request: Request, ctx: Ctx): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const p = statusSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await adminSetStatus((await ctx.params).id, p.data.status));
}

const winnerSchema = z
  .object({
    action: z.enum(['award', 'revoke', 'edit']).optional(),
    rank: z.number().int().min(1).max(20).optional(),
    prizeTitle: z.string().max(120).optional(),
    appealId: z.string().min(1).optional(),
    accept: z.boolean().optional(),
    adminNote: z.string().max(300).optional(),
  })
  .strict();

/**
 * PATCH /api/admin/free-zone-rewards/:id/winners/:wid
 *  - { action: 'award' | 'revoke', adminNote? } acts on winner `wid`
 *  - { appealId, accept, adminNote? } resolves an appeal (`wid` is ignored; use "-")
 */
export async function handleWinnerOrAppeal(request: Request, ctx: WinnerCtx): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const p = winnerSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  if (p.data.appealId && typeof p.data.accept === 'boolean') {
    return respond(await adminResolveAppeal(p.data.appealId, p.data.accept, p.data.adminNote, p.data.rank));
  }
  if (p.data.action === 'edit' && p.data.rank !== undefined) {
    return respond(await adminEditWinner((await ctx.params).wid, p.data.rank, p.data.prizeTitle));
  }
  if (p.data.action === 'award' || p.data.action === 'revoke') return respond(await adminActOnWinner((await ctx.params).wid, p.data.action, p.data.adminNote));
  return bad();
}

/** GET /api/admin/free-zone-reviews?status=APPROVED|HIDDEN */
export async function handleListReviews(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const q = new URL(request.url).searchParams.get('status');
  return jsonOk(await adminListReviews(q === 'HIDDEN' ? 'HIDDEN' : 'APPROVED'));
}

const reviewSchema = z.object({ status: z.enum(['APPROVED', 'HIDDEN']) }).strict();

/** PATCH /api/admin/free-zone-reviews/:id  { status } — hide or restore a review. */
export async function handleSetReviewStatus(request: Request, ctx: Ctx): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const p = reviewSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await adminSetReviewStatus((await ctx.params).id, p.data.status));
}

// ---------- dashboard / questions / slots / points / comment moderation ----------

const qs = (request: Request) => new URL(request.url).searchParams;

/** GET /api/admin/free-zone-overview */
export async function handleOverview(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  return jsonOk(await adminOverview());
}

/** GET /api/admin/free-zone-questions?status=&q=&skip= */
export async function handleAdminQuestions(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const p = qs(request);
  const skip = Number(p.get('skip') ?? 0);
  return jsonOk(
    await adminListQuestions({ status: p.get('status') ?? undefined, q: p.get('q') ?? undefined, skip: Number.isFinite(skip) ? skip : 0 }),
  );
}

/** GET /api/admin/free-zone-questions/:id */
export async function handleAdminQuestion(request: Request, ctx: Ctx): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const q = await adminGetQuestion((await ctx.params).id);
  return q ? jsonOk(q) : jsonError('NOT_FOUND', 'প্রশ্নটি পাওয়া যায়নি।', 404);
}

/** GET /api/admin/free-zone-slots?scope=upcoming|past */
export async function handleAdminSlots(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  return jsonOk({ items: await adminListSlots(qs(request).get('scope') === 'past' ? 'past' : 'upcoming') });
}

/** GET /api/admin/free-zone-ledger?period=week|month|all */
export async function handleAdminPoints(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const v = qs(request).get('period');
  return jsonOk(await adminPoints(v === 'month' || v === 'all' ? v : 'week'));
}

/** GET /api/admin/free-zone-comments (reported comments) */
export async function handleAdminReportedComments(request: Request): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  return jsonOk({ items: await adminReportedComments() });
}

const commentActionSchema = z.object({ action: z.enum(['DISMISS', 'HIDE']) }).strict();

/** PATCH /api/admin/free-zone-comments/:id  { action: DISMISS | HIDE } */
export async function handleAdminResolveComment(request: Request, ctx: Ctx): Promise<Response> {
  const e = await requireAdminPanelApiAccess(request);
  if (e) return e;
  const p = commentActionSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await adminResolveComment((await ctx.params).id, p.data.action));
}
