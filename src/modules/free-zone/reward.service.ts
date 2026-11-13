import { Prisma } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { sendPushToUser } from '../push/fcm.service.js';

import { canMove, checkPeriod, rankWinners, type PeriodInput, type WinnerAction } from './reward.rules.js';

export type RwResult<T> =
  | { ok: true; data: T }
  | { ok: false; httpStatus: number; code: string; message: string };

const fail = (httpStatus: number, code: string, message: string): RwResult<never> => ({ ok: false, httpStatus, code, message });

const iso = (d: Date | null) => d?.toISOString() ?? null;

async function nameMap(userIds: string[]): Promise<Map<string, string>> {
  const docs = await getPrisma().doctorProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, displayName: true },
  });
  return new Map(docs.map((d) => [d.userId, d.displayName ?? 'ডাক্তার']));
}

// ---------------- admin ----------------

export async function adminListPeriods() {
  const rows = await getPrisma().freeZoneRewardPeriod.findMany({
    orderBy: { startsAt: 'desc' },
    take: 50,
    include: { prizes: { orderBy: { rank: 'asc' } }, _count: { select: { winners: true, appeals: true } } },
  });
  return {
    items: rows.map((p) => ({
      id: p.id,
      title: p.title,
      startsAt: p.startsAt.toISOString(),
      endsAt: p.endsAt.toISOString(),
      topN: p.topN,
      minPoints: p.minPoints,
      status: p.status,
      note: p.note,
      prizes: p.prizes.map((x) => ({ rank: x.rank, title: x.title, description: x.description })),
      winnerCount: p._count.winners,
      appealCount: p._count.appeals,
    })),
  };
}

export async function adminCreatePeriod(input: PeriodInput & { note?: string | undefined }): Promise<RwResult<{ id: string }>> {
  const bad = checkPeriod(input);
  if (bad) return fail(422, 'INVALID_PERIOD', bad);
  const row = await getPrisma().freeZoneRewardPeriod.create({
    data: {
      title: input.title.trim(),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      topN: input.topN,
      minPoints: input.minPoints,
      note: input.note?.trim() || null,
      prizes: {
        create: input.prizes.map((p) => ({ rank: p.rank, title: p.title.trim(), description: p.description?.trim() || null })),
      },
    },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id } };
}

export async function adminGetPeriod(id: string): Promise<RwResult<unknown>> {
  const prisma = getPrisma();
  const p = await prisma.freeZoneRewardPeriod.findUnique({
    where: { id },
    include: { prizes: { orderBy: { rank: 'asc' } }, winners: { orderBy: { rank: 'asc' } }, appeals: { orderBy: { createdAt: 'asc' } } },
  });
  if (!p) return fail(404, 'NOT_FOUND', 'সময়কালটি পাওয়া যায়নি।');
  const names = await nameMap([...p.winners.map((w) => w.userId), ...p.appeals.map((a) => a.userId)]);
  return {
    ok: true,
    data: {
      id: p.id,
      title: p.title,
      status: p.status,
      startsAt: p.startsAt.toISOString(),
      endsAt: p.endsAt.toISOString(),
      topN: p.topN,
      minPoints: p.minPoints,
      prizes: p.prizes.map((x) => ({ rank: x.rank, title: x.title })),
      winners: p.winners.map((w) => ({
        id: w.id,
        rank: w.rank,
        points: w.points,
        name: names.get(w.userId) ?? 'ডাক্তার',
        prizeTitle: w.prizeTitle,
        status: w.status,
        adminNote: w.adminNote,
        awardedAt: iso(w.awardedAt),
      })),
      appeals: p.appeals.map((a) => ({
        id: a.id,
        name: names.get(a.userId) ?? 'ডাক্তার',
        note: a.note,
        status: a.status,
        adminNote: a.adminNote,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
}

/** Admin: DRAFT→ACTIVE, or close (computes winners from the points ledger inside the window). */
export async function adminSetStatus(id: string, to: 'ACTIVE' | 'CLOSED'): Promise<RwResult<{ status: string; winners: number }>> {
  const prisma = getPrisma();
  const p = await prisma.freeZoneRewardPeriod.findUnique({ where: { id }, include: { prizes: true } });
  if (!p) return fail(404, 'NOT_FOUND', 'সময়কালটি পাওয়া যায়নি।');
  if (!canMove(p.status, to)) return fail(409, 'INVALID_STATUS', 'এই অবস্থা থেকে এই পরিবর্তন করা যায় না।');
  if (to === 'ACTIVE') {
    await prisma.freeZoneRewardPeriod.update({ where: { id }, data: { status: 'ACTIVE' } });
    return { ok: true, data: { status: 'ACTIVE', winners: 0 } };
  }
  const grouped = await prisma.pointLedger.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: p.startsAt, lt: p.endsAt }, points: { gt: 0 } },
    _sum: { points: true },
  });
  const winners = rankWinners(
    grouped.map((g) => ({ userId: g.userId, points: g._sum.points ?? 0 })),
    p.topN,
    p.minPoints,
  );
  const prizeFor = new Map(p.prizes.map((x) => [x.rank, x.title]));
  try {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.freeZoneRewardPeriod.updateMany({
        where: { id, status: { in: ['DRAFT', 'ACTIVE'] } },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      if (upd.count === 0) throw new Error('RACE');
      if (winners.length > 0) {
        await tx.freeZoneRewardWinner.createMany({
          data: winners.map((w) => ({ periodId: id, userId: w.userId, rank: w.rank, points: w.points, prizeTitle: prizeFor.get(w.rank) ?? null })),
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'RACE') return fail(409, 'INVALID_STATUS', 'সময়কালটি ইতিমধ্যে বন্ধ।');
    throw err;
  }
  return { ok: true, data: { status: 'CLOSED', winners: winners.length } };
}

export async function adminActOnWinner(winnerId: string, action: WinnerAction, adminNote: string | undefined): Promise<RwResult<{ status: string }>> {
  const status = action === 'award' ? 'AWARDED' : 'REVOKED';
  let userId: string;
  let prizeTitle: string | null;
  try {
    const w = await getPrisma().freeZoneRewardWinner.update({
      where: { id: winnerId },
      data: { status, adminNote: adminNote?.trim() || null, awardedAt: action === 'award' ? new Date() : null },
      select: { userId: true, prizeTitle: true },
    });
    userId = w.userId;
    prizeTitle = w.prizeTitle;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return fail(404, 'NOT_FOUND', 'বিজয়ী পাওয়া যায়নি।');
    throw err;
  }
  if (action === 'award') {
    await sendPushToUser(userId, {
      title: 'অভিনন্দন! 🎉',
      body: prizeTitle ? `আপনি ফ্রি জোনে পুরস্কার জিতেছেন: ${prizeTitle}` : 'আপনি ফ্রি জোনে পুরস্কার জিতেছেন।',
      data: { type: 'FREE_ZONE_REWARD' },
    });
  }
  return { ok: true, data: { status } };
}

/** Admin: change rank / prize label of an existing winner (e.g. after an appeal). */
export async function adminEditWinner(winnerId: string, rank: number, prizeTitle: string | undefined): Promise<RwResult<{ status: string }>> {
  try {
    await getPrisma().freeZoneRewardWinner.update({
      where: { id: winnerId },
      data: { rank, prizeTitle: prizeTitle?.trim() || null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return fail(404, 'NOT_FOUND', 'বিজয়ী পাওয়া যায়নি।');
    throw err;
  }
  return { ok: true, data: { status: 'UPDATED' } };
}

/**
 * Resolve an appeal. Accepting with `rank` also adds the doctor to the winners
 * (points = their ledger total inside the period window, prize = the period's prize for that rank).
 */
export async function adminResolveAppeal(
  appealId: string,
  accept: boolean,
  adminNote: string | undefined,
  rank?: number,
): Promise<RwResult<{ status: string }>> {
  const prisma = getPrisma();
  const status = accept ? 'ACCEPTED' : 'REJECTED';
  const appeal = await prisma.freeZoneRewardAppeal.findUnique({ where: { id: appealId }, include: { period: { include: { prizes: true } } } });
  if (!appeal || appeal.status !== 'OPEN') return fail(404, 'NOT_FOUND', 'আপিল পাওয়া যায়নি বা আগেই নিষ্পত্তি হয়েছে।');
  const note = adminNote?.trim() || null;
  await prisma.$transaction(async (tx) => {
    const r = await tx.freeZoneRewardAppeal.updateMany({ where: { id: appealId, status: 'OPEN' }, data: { status, adminNote: note } });
    if (r.count === 0) throw new Error('RACE');
    if (accept && rank !== undefined) {
      const sum = await tx.pointLedger.aggregate({
        where: { userId: appeal.userId, createdAt: { gte: appeal.period.startsAt, lt: appeal.period.endsAt }, points: { gt: 0 } },
        _sum: { points: true },
      });
      const prizeTitle = appeal.period.prizes.find((x) => x.rank === rank)?.title ?? null;
      await tx.freeZoneRewardWinner.upsert({
        where: { periodId_userId: { periodId: appeal.periodId, userId: appeal.userId } },
        create: { periodId: appeal.periodId, userId: appeal.userId, rank, points: sum._sum.points ?? 0, prizeTitle },
        update: { rank, prizeTitle, status: 'PENDING' },
      });
    }
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === 'RACE') return;
    throw err;
  });
  return { ok: true, data: { status } };
}

// ---------------- review moderation ----------------

export async function adminListReviews(status: 'APPROVED' | 'HIDDEN') {
  const rows = await getPrisma().freeZoneReview.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const names = await nameMap([...new Set(rows.map((r) => r.doctorUserId))]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      doctorName: names.get(r.doctorUserId) ?? 'ডাক্তার',
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function adminSetReviewStatus(id: string, status: 'APPROVED' | 'HIDDEN'): Promise<RwResult<{ status: string }>> {
  try {
    await getPrisma().freeZoneReview.update({ where: { id }, data: { status } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return fail(404, 'NOT_FOUND', 'রিভিউ পাওয়া যায়নি।');
    throw err;
  }
  return { ok: true, data: { status } };
}

// ---------------- partner (doctor) ----------------

export async function partnerRewards(userId: string) {
  const prisma = getPrisma();
  const periods = await prisma.freeZoneRewardPeriod.findMany({
    where: { status: { in: ['ACTIVE', 'CLOSED'] } },
    orderBy: { startsAt: 'desc' },
    take: 10,
    include: { prizes: { orderBy: { rank: 'asc' } } },
  });
  const ids = periods.map((p) => p.id);
  const [mine, appeals] = await Promise.all([
    prisma.freeZoneRewardWinner.findMany({ where: { userId, periodId: { in: ids } } }),
    prisma.freeZoneRewardAppeal.findMany({ where: { userId, periodId: { in: ids } } }),
  ]);
  return {
    items: periods.map((p) => {
      const w = mine.find((x) => x.periodId === p.id);
      const a = appeals.find((x) => x.periodId === p.id);
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        startsAt: p.startsAt.toISOString(),
        endsAt: p.endsAt.toISOString(),
        topN: p.topN,
        prizes: p.prizes.map((x) => ({ rank: x.rank, title: x.title, description: x.description })),
        myResult: w ? { rank: w.rank, points: w.points, prizeTitle: w.prizeTitle, status: w.status } : null,
        myAppeal: a ? { status: a.status, adminNote: a.adminNote } : null,
      };
    }),
  };
}

export async function partnerAppeal(userId: string, periodId: string, note: string): Promise<RwResult<{ ok: true }>> {
  const text = note.trim();
  if (text.length < 10 || text.length > 1000) return fail(422, 'VALIDATION_ERROR', 'আপিলের কারণ ১০ থেকে ১০০০ অক্ষরের মধ্যে লিখুন।');
  const prisma = getPrisma();
  const doc = await prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!doc) return fail(403, 'NOT_DOCTOR', 'শুধু ডাক্তার আপিল করতে পারবেন।');
  const p = await prisma.freeZoneRewardPeriod.findUnique({ where: { id: periodId }, select: { status: true } });
  if (!p || p.status !== 'CLOSED') return fail(409, 'NOT_CLOSED', 'ফল প্রকাশের পরই আপিল করা যায়।');
  try {
    await prisma.freeZoneRewardAppeal.create({ data: { periodId, userId, note: text } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return fail(409, 'ALREADY_APPEALED', 'আপনি এই সময়কালে আগেই আপিল করেছেন।');
    throw err;
  }
  return { ok: true, data: { ok: true } };
}
