import { Prisma } from '../../generated/prisma/index.js';
import { guardFields } from '../contact-guard/index.js';
import { sendPushToUser } from '../push/fcm.service.js';
import { getPrisma } from '../../shared/database/prisma.js';

import {
  checkCommentBody,
  ownerToggle,
  statusAfterAdmin,
  statusAfterReport,
  viewerCanSeeComment,
  type AdminCommentAction,
  type CommentStatus,
} from './comment.rules.js';
import { getFreeZonePolicy } from './free-zone.policy.service.js';

export type CmResult<T> =
  | { ok: true; data: T }
  | { ok: false; httpStatus: number; code: string; message: string };

const fail = (httpStatus: number, code: string, message: string): CmResult<never> => ({ ok: false, httpStatus, code, message });
const NOT_FOUND = () => fail(404, 'NOT_FOUND', 'প্রশ্ন বা মন্তব্যটি পাওয়া যায়নি।');
const DISABLED = () => fail(503, 'FREE_ZONE_DISABLED', 'ফ্রি জোন এখন সাময়িকভাবে বন্ধ আছে।');

const COMMENTS_PER_MINUTE = 5;
const MAX_REASON = 300;

type Role = 'DOCTOR' | 'CUSTOMER';

async function loadQuestion(requestId: string) {
  const r = await getPrisma().serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, serviceType: true, status: true, problemOrSymptom: true, customer: { select: { userId: true } } },
  });
  if (!r || r.serviceType !== 'FREE_CONSULTATION') return null;
  return { id: r.id, status: r.status, symptoms: r.problemOrSymptom, ownerUserId: r.customer?.userId ?? null };
}

/** Display names: verified doctors by name, the asker as "প্রশ্নকারী", everyone else anonymous. */
async function authorNames(userIds: string[]): Promise<Map<string, { name: string; verified: boolean }>> {
  const out = new Map<string, { name: string; verified: boolean }>();
  if (userIds.length === 0) return out;
  const docs = await getPrisma().doctorProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, displayName: true, providerStatus: true },
  });
  for (const d of docs) out.set(d.userId, { name: d.displayName ?? 'ডাক্তার', verified: d.providerStatus === 'ACTIVE' });
  return out;
}

// ---------- public feed ----------

/** Public Q&A feed: the asker's identity is never exposed. */
export async function publicFeed(viewerUserId: string) {
  const prisma = getPrisma();
  const rows = await prisma.serviceRequest.findMany({
    where: { serviceType: 'FREE_CONSULTATION', status: { notIn: ['CANCELLED', 'REJECTED'] } },
    orderBy: { submittedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      status: true,
      isEmergency: true,
      problemOrSymptom: true,
      submittedAt: true,
      animal: { select: { species: true } },
      customer: { select: { userId: true } },
    },
  });
  const counts = await prisma.freeQuestionComment.groupBy({
    by: ['requestId'],
    where: { requestId: { in: rows.map((r) => r.id) }, status: 'VISIBLE' },
    _count: { _all: true },
  });
  const n = new Map(counts.map((c) => [c.requestId, c._count._all]));
  return {
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      isEmergency: r.isEmergency,
      symptoms: r.problemOrSymptom,
      species: r.animal?.species ?? '',
      submittedAt: r.submittedAt.toISOString(),
      isMine: r.customer?.userId === viewerUserId,
      commentCount: n.get(r.id) ?? 0,
    })),
  };
}

// ---------- comments ----------

export async function listComments(viewerUserId: string, requestId: string): Promise<CmResult<{ isQuestionOwner: boolean; items: unknown[] }>> {
  const q = await loadQuestion(requestId);
  if (!q) return NOT_FOUND();
  const prisma = getPrisma();
  const isQuestionOwner = q.ownerUserId === viewerUserId;
  const rows = await prisma.freeQuestionComment.findMany({ where: { requestId }, orderBy: { createdAt: 'asc' }, take: 200 });
  const visible = rows.filter((c) =>
    viewerCanSeeComment({ status: c.status as CommentStatus, isAuthor: c.authorUserId === viewerUserId, isQuestionOwner }),
  );
  const [names, reported] = await Promise.all([
    authorNames([...new Set(visible.map((c) => c.authorUserId))]),
    visible.length
      ? prisma.freeQuestionCommentReport.findMany({
          where: { reporterUserId: viewerUserId, commentId: { in: visible.map((c) => c.id) } },
          select: { commentId: true },
        })
      : Promise.resolve([] as { commentId: string }[]),
  ]);
  const reportedSet = new Set(reported.map((r) => r.commentId));
  return {
    ok: true,
    data: {
      isQuestionOwner,
      items: visible.map((c) => {
        const mine = c.authorUserId === viewerUserId;
        const fromAsker = c.authorUserId === q.ownerUserId;
        const doc = names.get(c.authorUserId);
        const status = c.status as CommentStatus;
        return {
          id: c.id,
          body: c.body,
          authorRole: c.authorRole,
          authorName: c.authorRole === 'DOCTOR' && doc ? doc.name : fromAsker ? 'প্রশ্নকারী' : 'গ্রাহক',
          verified: c.authorRole === 'DOCTOR' && !!doc?.verified,
          isMine: mine,
          isFromAsker: fromAsker,
          hidden: status !== 'VISIBLE',
          createdAt: c.createdAt.toISOString(),
          reportedByMe: reportedSet.has(c.id),
          canHide: isQuestionOwner && status === 'VISIBLE',
          canUnhide: isQuestionOwner && status === 'HIDDEN_BY_OWNER',
          canReport: !mine && status === 'VISIBLE' && !reportedSet.has(c.id),
        };
      }),
    },
  };
}

export async function postComment(userId: string, role: Role, requestId: string, body: string): Promise<CmResult<{ id: string }>> {
  if (!(await getFreeZonePolicy()).enabled) return DISABLED();
  const bad = checkCommentBody(body);
  if (bad) return fail(422, 'INVALID_COMMENT', bad);
  const q = await loadQuestion(requestId);
  if (!q || q.status === 'CANCELLED' || q.status === 'REJECTED') return NOT_FOUND();
  const prisma = getPrisma();
  if (role === 'DOCTOR') {
    const doc = await prisma.doctorProfile.findUnique({ where: { userId }, select: { providerStatus: true } });
    if (doc?.providerStatus !== 'ACTIVE') return fail(403, 'NOT_ACTIVE', 'শুধু যাচাইকৃত সক্রিয় ডাক্তার মন্তব্য করতে পারবেন।');
  }
  const recent = await prisma.freeQuestionComment.count({ where: { authorUserId: userId, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recent >= COMMENTS_PER_MINUTE) return fail(429, 'TOO_MANY', 'একটু পরে আবার মন্তব্য করুন।');
  const trimmed = body.trim();
  const blocked = await guardFields(userId, 'USER_CHAT', { comment: trimmed }, { entityType: 'FREE_QUESTION', entityId: requestId });
  if (blocked) return fail(blocked.suspended ? 403 : 422, blocked.code, blocked.messageBn);
  const created = await prisma.freeQuestionComment.create({
    data: { requestId, authorUserId: userId, authorRole: role, body: trimmed },
    select: { id: true },
  });
  if (q.ownerUserId && q.ownerUserId !== userId) {
    void sendPushToUser(q.ownerUserId, {
      title: 'আপনার প্রশ্নে নতুন মন্তব্য',
      body: trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed,
      data: { type: 'FREE_QUESTION_COMMENT', requestId },
    }).catch(() => undefined);
  }
  return { ok: true, data: created };
}

/** Asker hides/unhides a comment on their own question. */
export async function ownerSetHidden(userId: string, commentId: string, hide: boolean): Promise<CmResult<{ hidden: boolean }>> {
  const prisma = getPrisma();
  const c = await prisma.freeQuestionComment.findUnique({ where: { id: commentId }, select: { id: true, requestId: true, status: true } });
  if (!c) return NOT_FOUND();
  const q = await loadQuestion(c.requestId);
  if (!q || q.ownerUserId !== userId) return fail(403, 'NOT_OWNER', 'শুধু প্রশ্নকারী মন্তব্য লুকাতে বা দেখাতে পারবেন।');
  const next = ownerToggle(c.status as CommentStatus, hide);
  if (!next) return fail(409, 'LOCKED', 'এই মন্তব্যটি অ্যাডমিন বা সিস্টেম লুকিয়েছে, আপনি বদলাতে পারবেন না।');
  await prisma.freeQuestionComment.update({
    where: { id: commentId },
    data: { status: next, hiddenAt: next === 'VISIBLE' ? null : new Date() },
  });
  return { ok: true, data: { hidden: next !== 'VISIBLE' } };
}

export async function reportComment(userId: string, commentId: string, reason: string | undefined): Promise<CmResult<{ autoHidden: boolean }>> {
  const prisma = getPrisma();
  const c = await prisma.freeQuestionComment.findUnique({ where: { id: commentId }, select: { id: true, authorUserId: true, status: true } });
  if (!c || c.status !== 'VISIBLE') return NOT_FOUND();
  if (c.authorUserId === userId) return fail(409, 'OWN_COMMENT', 'নিজের মন্তব্য রিপোর্ট করা যায় না।');
  const threshold = (await getFreeZonePolicy()).commentReportAutoHide;
  try {
    const autoHidden = await prisma.$transaction(async (tx) => {
      await tx.freeQuestionCommentReport.create({
        data: { commentId, reporterUserId: userId, reason: reason?.trim().slice(0, MAX_REASON) || null },
      });
      const open = await tx.freeQuestionCommentReport.count({ where: { commentId, status: 'OPEN' } });
      const next = statusAfterReport(c.status as CommentStatus, open, threshold);
      if (next !== c.status) {
        await tx.freeQuestionComment.update({ where: { id: commentId }, data: { status: next, hiddenAt: new Date() } });
        return true;
      }
      return false;
    });
    return { ok: true, data: { autoHidden } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return fail(409, 'ALREADY_REPORTED', 'আপনি আগেই এই মন্তব্য রিপোর্ট করেছেন।');
    }
    throw err;
  }
}

// ---------- admin moderation ----------

/** Comments with at least one open report, most-reported first. */
export async function adminReportedComments() {
  const prisma = getPrisma();
  const rows = await prisma.freeQuestionComment.findMany({
    where: { reports: { some: { status: 'OPEN' } } },
    include: { reports: { where: { status: 'OPEN' }, select: { reason: true, createdAt: true } } },
    take: 100,
  });
  const reqs = await prisma.serviceRequest.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.requestId))] } },
    select: { id: true, problemOrSymptom: true },
  });
  const symptoms = new Map(reqs.map((r) => [r.id, r.problemOrSymptom]));
  const names = await authorNames([...new Set(rows.map((r) => r.authorUserId))]);
  return rows
    .map((c) => ({
      id: c.id,
      requestId: c.requestId,
      questionSymptoms: symptoms.get(c.requestId) ?? null,
      body: c.body,
      authorRole: c.authorRole,
      authorName: names.get(c.authorUserId)?.name ?? 'গ্রাহক',
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      openReports: c.reports.length,
      reasons: c.reports.map((r) => r.reason).filter((x): x is string => !!x),
    }))
    .sort((a, b) => b.openReports - a.openReports);
}

/** Admin: DISMISS (restore auto-hidden, close reports) or HIDE (hide for good, close reports as actioned). */
export async function adminResolveComment(commentId: string, action: AdminCommentAction): Promise<CmResult<{ status: CommentStatus }>> {
  const prisma = getPrisma();
  const c = await prisma.freeQuestionComment.findUnique({ where: { id: commentId }, select: { status: true } });
  if (!c) return NOT_FOUND();
  const next = statusAfterAdmin(c.status as CommentStatus, action);
  await prisma.$transaction([
    prisma.freeQuestionComment.update({
      where: { id: commentId },
      data: { status: next, hiddenAt: next === 'VISIBLE' ? null : new Date() },
    }),
    prisma.freeQuestionCommentReport.updateMany({
      where: { commentId, status: 'OPEN' },
      data: { status: action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED', resolvedAt: new Date() },
    }),
  ]);
  return { ok: true, data: { status: next } };
}
