import { getPrisma } from '../../shared/database/prisma.js';

import { periodStart } from './points.rules.js';

/** Read-only admin views for the Free Zone section (overview, questions, slots, points). */

type QuestionStatus = 'PENDING' | 'ACCEPTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
const FREE = 'FREE_CONSULTATION' as const;

export async function adminOverview() {
  const prisma = getPrisma();
  const now = new Date();
  const [byStatus, comments, openReports, upcomingSlots, activeBookings, points, activePeriods, reviews] = await Promise.all([
    prisma.serviceRequest.groupBy({ by: ['status'], where: { serviceType: FREE }, _count: { _all: true } }),
    prisma.freeQuestionComment.count(),
    prisma.freeQuestionCommentReport.count({ where: { status: 'OPEN' } }),
    prisma.partnerFreeSlot.count({ where: { startsAt: { gte: now } } }),
    prisma.freeSlotBooking.count({ where: { status: 'BOOKED', slot: { startsAt: { gte: now } } } }),
    prisma.pointLedger.aggregate({ where: { points: { gt: 0 } }, _sum: { points: true } }),
    prisma.freeZoneRewardPeriod.count({ where: { status: 'ACTIVE' } }),
    prisma.freeZoneReview.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const st = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Partial<Record<QuestionStatus, number>>;
  const total = byStatus.reduce((a, s) => a + s._count._all, 0);
  const rv = Object.fromEntries(reviews.map((r) => [r.status, r._count._all])) as Record<string, number>;
  return {
    questions: { total, byStatus: st },
    comments: { total: comments, openReports },
    slots: { upcoming: upcomingSlots, activeBookings },
    points: { awarded: points._sum.points ?? 0 },
    rewards: { activePeriods },
    reviews: { approved: rv.APPROVED ?? 0, hidden: rv.HIDDEN ?? 0 },
  };
}

const STATUSES = new Set<string>(['PENDING', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED']);

export async function adminListQuestions(opts: { status?: string | undefined; q?: string | undefined; skip?: number; take?: number }) {
  const prisma = getPrisma();
  const take = Math.min(Math.max(opts.take ?? 30, 1), 100);
  const skip = Math.max(opts.skip ?? 0, 0);
  const q = opts.q?.trim();
  const where = {
    serviceType: FREE,
    ...(opts.status && STATUSES.has(opts.status) ? { status: opts.status as QuestionStatus } : {}),
    ...(q ? { problemOrSymptom: { contains: q, mode: 'insensitive' as const } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        status: true,
        isEmergency: true,
        problemOrSymptom: true,
        submittedAt: true,
        assignedDoctorId: true,
        animal: { select: { species: true } },
      },
    }),
  ]);
  const ids = rows.map((r) => r.id);
  const docIds = [...new Set(rows.map((r) => r.assignedDoctorId).filter((x): x is string => !!x))];
  const [docs, cc, reviews] = await Promise.all([
    prisma.doctorProfile.findMany({ where: { id: { in: docIds } }, select: { id: true, displayName: true } }),
    prisma.freeQuestionComment.groupBy({ by: ['requestId'], where: { requestId: { in: ids } }, _count: { _all: true } }),
    prisma.freeZoneReview.findMany({ where: { requestId: { in: ids } }, select: { requestId: true, rating: true } }),
  ]);
  const dn = new Map(docs.map((d) => [d.id, d.displayName ?? 'ডাক্তার']));
  const cn = new Map(cc.map((c) => [c.requestId, c._count._all]));
  const rt = new Map(reviews.map((r) => [r.requestId, r.rating]));
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      isEmergency: r.isEmergency,
      symptoms: r.problemOrSymptom,
      species: r.animal?.species ?? '',
      submittedAt: r.submittedAt.toISOString(),
      doctorName: r.assignedDoctorId ? (dn.get(r.assignedDoctorId) ?? 'ডাক্তার') : null,
      commentCount: cn.get(r.id) ?? 0,
      rating: rt.get(r.id) ?? null,
    })),
  };
}

export async function adminGetQuestion(id: string) {
  const prisma = getPrisma();
  const r = await prisma.serviceRequest.findUnique({
    where: { id },
    select: {
      id: true,
      serviceType: true,
      status: true,
      isEmergency: true,
      problemOrSymptom: true,
      description: true,
      submittedAt: true,
      assignedDoctorId: true,
      animal: { select: { name: true, species: true, breed: true } },
      customer: { select: { userId: true } },
    },
  });
  if (!r || r.serviceType !== FREE) return null;
  const [doc, review, comments] = await Promise.all([
    r.assignedDoctorId
      ? prisma.doctorProfile.findUnique({ where: { id: r.assignedDoctorId }, select: { displayName: true } })
      : Promise.resolve(null),
    prisma.freeZoneReview.findUnique({ where: { requestId: id }, select: { rating: true, comment: true, status: true } }),
    prisma.freeQuestionComment.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'asc' },
      take: 300,
      include: { reports: { select: { status: true } } },
    }),
  ]);
  const authorIds = [...new Set(comments.map((c) => c.authorUserId))];
  const docs = await prisma.doctorProfile.findMany({ where: { userId: { in: authorIds } }, select: { userId: true, displayName: true } });
  const dn = new Map(docs.map((d) => [d.userId, d.displayName ?? 'ডাক্তার']));
  return {
    id: r.id,
    status: r.status,
    isEmergency: r.isEmergency,
    symptoms: r.problemOrSymptom,
    description: r.description,
    submittedAt: r.submittedAt.toISOString(),
    animal: r.animal ? { name: r.animal.name, species: r.animal.species, breed: r.animal.breed } : null,
    doctorName: doc?.displayName ?? null,
    review: review ? { rating: review.rating, comment: review.comment, status: review.status } : null,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorRole: c.authorRole,
      authorName: c.authorRole === 'DOCTOR' ? (dn.get(c.authorUserId) ?? 'ডাক্তার') : c.authorUserId === r.customer?.userId ? 'প্রশ্নকারী' : 'গ্রাহক',
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      openReports: c.reports.filter((x) => x.status === 'OPEN').length,
    })),
  };
}

export async function adminListSlots(scope: 'upcoming' | 'past') {
  const prisma = getPrisma();
  const now = new Date();
  const rows = await prisma.partnerFreeSlot.findMany({
    where: scope === 'upcoming' ? { startsAt: { gte: now } } : { startsAt: { lt: now } },
    orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
    take: 100,
  });
  const ids = rows.map((r) => r.id);
  const [booked, docs] = await Promise.all([
    prisma.freeSlotBooking.groupBy({ by: ['slotId'], where: { slotId: { in: ids }, status: 'BOOKED' }, _count: { _all: true } }),
    prisma.doctorProfile.findMany({ where: { userId: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { userId: true, displayName: true } }),
  ]);
  const bc = new Map(booked.map((b) => [b.slotId, b._count._all]));
  const dn = new Map(docs.map((d) => [d.userId, d.displayName ?? 'ডাক্তার']));
  return rows.map((r) => ({
    id: r.id,
    doctorName: dn.get(r.userId) ?? 'ডাক্তার',
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    mode: r.mode,
    capacity: r.capacity,
    bookedCount: bc.get(r.id) ?? 0,
    animalTypes: r.animalTypes,
    note: r.note,
  }));
}

/** Leaderboard (week | month | all) plus the latest ledger rows, with doctor names. */
export async function adminPoints(period: 'week' | 'month' | 'all') {
  const prisma = getPrisma();
  const since = period === 'all' ? new Date(0) : periodStart(period, new Date());
  const [rows, ledger] = await Promise.all([
    prisma.pointLedger.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since }, points: { gt: 0 } },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 50,
    }),
    prisma.pointLedger.findMany({ where: { points: { gt: 0 } }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  const userIds = [...new Set([...rows.map((r) => r.userId), ...ledger.map((l) => l.userId)])];
  const docs = await prisma.doctorProfile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, displayName: true, providerStatus: true } });
  const dn = new Map(docs.map((d) => [d.userId, d]));
  const name = (id: string) => dn.get(id)?.displayName ?? 'ডাক্তার';
  return {
    period,
    since: since.toISOString(),
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      name: name(r.userId),
      verified: dn.get(r.userId)?.providerStatus === 'ACTIVE',
      points: r._sum.points ?? 0,
    })),
    ledger: ledger.map((l) => ({
      id: l.id,
      name: name(l.userId),
      eventType: l.eventType,
      points: l.points,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}
