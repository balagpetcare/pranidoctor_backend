import { z } from 'zod';

import { requireAdminPanelApiAccess } from '../../../legacy/web/lib/admin-auth/api-guard.js';
import { jsonError, jsonOk } from '../../../legacy/web/lib/api-response.js';
import { requireMobileCustomer } from '../../../legacy/web/lib/mobile-auth/guard.js';
import { listComments, ownerSetHidden, postComment, publicFeed, reportComment } from '../../free-zone/comment.service.js';
import { getFreeZonePolicy, saveFreeZonePolicy } from '../../free-zone/free-zone.policy.service.js';
import {
  bookSlot,
  cancelBooking,
  claimFree,
  createSlot,
  deleteSlot,
  getQuota,
  leaderboard,
  listMyBookings,
  listMyQuestions,
  listFreeQueue,
  listMySlots,
  listPublicSlots,
  myPoints,
  rateFree,
  submitFreeQuestion,
  type FzResult,
} from '../../free-zone/free-zone.service.js';
import { partnerAppeal, partnerRewards } from '../../free-zone/reward.service.js';
import { requirePartnerUser } from '../../partner-auth/partner-guard.js';

type Ctx = { params: Promise<{ id: string }> };

function respond<T>(r: FzResult<T>): Response {
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

// ---------- customer ----------

/** GET /api/mobile/free-zone/quota */
export async function handleQuota(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return jsonOk(await getQuota(auth.ctx.customerProfileId));
}

const submitSchema = z
  .object({
    animalId: z.string().min(1),
    symptoms: z.string().min(1).max(1000),
    description: z.string().max(2000).optional(),
    isEmergency: z.boolean().default(false),
  })
  .strict();

/** POST /api/mobile/free-zone/questions */
export async function handleSubmit(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const p = submitSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await submitFreeQuestion(auth.ctx.customerProfileId, auth.ctx.userId, p.data));
}

const rateSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).strict();

/** POST /api/mobile/free-zone/questions/:id/rate */
export async function handleRate(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const p = rateSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await rateFree(auth.ctx.customerProfileId, (await ctx.params).id, p.data.rating, p.data.comment));
}

/** GET /api/mobile/free-zone/slots (public upcoming free slots) */
export async function handlePublicSlots(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return jsonOk({ items: await listPublicSlots(auth.ctx.customerProfileId) });
}

/** POST /api/mobile/free-zone/slots/:id/book */
export async function handleBookSlot(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return respond(await bookSlot(auth.ctx.customerProfileId, (await ctx.params).id));
}

/** DELETE /api/mobile/free-zone/slots/:id/book */
export async function handleCancelBooking(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return respond(await cancelBooking(auth.ctx.customerProfileId, (await ctx.params).id));
}

/** GET /api/mobile/free-zone/bookings */
export async function handleMyBookings(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return jsonOk(await listMyBookings(auth.ctx.customerProfileId));
}

// ---------- partner ----------

/** GET /api/mobile/partner/free-zone/queue */
export async function handleQueue(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return respond(await listFreeQueue(auth.userId));
}

/** POST /api/mobile/partner/free-zone/queue/:id/claim */
export async function handleClaim(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return respond(await claimFree(auth.userId, (await ctx.params).id));
}

/** GET /api/mobile/partner/free-zone/points */
export async function handlePoints(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return jsonOk(await myPoints(auth.userId));
}

/** GET /api/mobile/partner/free-zone/slots */
export async function handleMySlots(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return jsonOk({ items: await listMySlots(auth.userId) });
}

const slotSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    capacity: z.number().int().min(1).max(50).default(1),
    mode: z.enum(['TEXT', 'AUDIO', 'VIDEO']).default('TEXT'),
    animalTypes: z.array(z.string().min(1).max(40)).max(10).default([]),
    note: z.string().max(300).optional(),
  })
  .strict();

/** POST /api/mobile/partner/free-zone/slots */
export async function handleCreateSlot(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const p = slotSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await createSlot(auth.userId, p.data));
}

/** DELETE /api/mobile/partner/free-zone/slots/:id */
export async function handleDeleteSlot(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return respond(await deleteSlot(auth.userId, (await ctx.params).id));
}

// ---------- admin ----------

const policySchema = z
  .object({
    enabled: z.boolean(),
    welcomeDays: z.number().int().min(1).max(365),
    welcomeLimit: z.number().int().min(0).max(100),
    monthlyLimit: z.number().int().min(0).max(100),
    dailyLimit: z.number().int().min(1).max(20),
    emergencyExempt: z.boolean(),
    emergencyDailyFree: z.number().int().min(0).max(20),
    liveMaxTiles: z.number().int().min(2).max(9),
    commentReportAutoHide: z.number().int().min(1).max(50),
  })
  .strict();

/** GET /api/admin/free-zone-policy */
export async function handleGetPolicy(request: Request): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  return jsonOk(await getFreeZonePolicy());
}

/** PUT /api/admin/free-zone-policy */
export async function handlePutPolicy(request: Request): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  const p = policySchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return jsonOk(await saveFreeZonePolicy(p.data));
}

const lbQuery = z.object({ period: z.enum(['week', 'month']).catch('week') });

/** GET /api/mobile/partner/free-zone/leaderboard?period=week|month */
export async function handleLeaderboard(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const q = lbQuery.parse({ period: new URL(request.url).searchParams.get('period') ?? undefined });
  return respond(await leaderboard(auth.userId, q.period));
}

/** GET /api/mobile/free-zone/questions (customer's own) */
export async function handleMyQuestions(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return jsonOk(await listMyQuestions(auth.ctx.customerProfileId));
}

/** GET /api/mobile/partner/free-zone/rewards */
export async function handlePartnerRewards(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return jsonOk(await partnerRewards(auth.userId));
}

const appealSchema = z.object({ note: z.string().min(1).max(1000) }).strict();

/** POST /api/mobile/partner/free-zone/rewards/:id/appeal */
export async function handlePartnerAppeal(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const p = appealSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  const r = await partnerAppeal(auth.userId, (await ctx.params).id, p.data.note);
  return r.ok ? jsonOk(r.data) : jsonError(r.code, r.message, r.httpStatus);
}

// ---------- public Q&A thread: feed, comments, hide, report ----------

const commentSchema = z.object({ body: z.string().min(1).max(1000) }).strict();
const hideSchema = z.object({ hidden: z.boolean() }).strict();
const reportSchema = z.object({ reason: z.string().max(300).optional() }).strict();

/** GET /api/mobile/free-zone/feed */
export async function handleFeed(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return jsonOk(await publicFeed(auth.ctx.userId));
}

/** GET /api/mobile/free-zone/questions/:id/comments */
export async function handleListComments(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  return respond(await listComments(auth.ctx.userId, (await ctx.params).id));
}

/** POST /api/mobile/free-zone/questions/:id/comments */
export async function handlePostComment(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const p = commentSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await postComment(auth.ctx.userId, 'CUSTOMER', (await ctx.params).id, p.data.body));
}

/** PATCH /api/mobile/free-zone/comments/:id  { hidden } — asker only */
export async function handleHideComment(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const p = hideSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await ownerSetHidden(auth.ctx.userId, (await ctx.params).id, p.data.hidden));
}

/** POST /api/mobile/free-zone/comments/:id/report */
export async function handleReportComment(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;
  const p = reportSchema.safeParse((await readJson(request)) ?? {});
  if (!p.success) return bad();
  return respond(await reportComment(auth.ctx.userId, (await ctx.params).id, p.data.reason));
}

/** GET /api/mobile/partner/free-zone/feed */
export async function handlePartnerFeed(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return jsonOk(await publicFeed(auth.userId));
}

/** GET /api/mobile/partner/free-zone/questions/:id/comments */
export async function handlePartnerListComments(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return respond(await listComments(auth.userId, (await ctx.params).id));
}

/** POST /api/mobile/partner/free-zone/questions/:id/comments (verified doctors only) */
export async function handlePartnerPostComment(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const p = commentSchema.safeParse(await readJson(request));
  if (!p.success) return bad();
  return respond(await postComment(auth.userId, 'DOCTOR', (await ctx.params).id, p.data.body));
}

/** POST /api/mobile/partner/free-zone/comments/:id/report */
export async function handlePartnerReportComment(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const p = reportSchema.safeParse((await readJson(request)) ?? {});
  if (!p.success) return bad();
  return respond(await reportComment(auth.userId, (await ctx.params).id, p.data.reason));
}
