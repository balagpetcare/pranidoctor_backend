import { Prisma, ServiceRequestEventType, UserRole } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { sendPushToUser } from '../push/fcm.service.js';
import { appendTimelineEvent } from '../timeline/timeline.service.js';

import { canCancelBooking, checkBooking } from './booking.rules.js';
import { getFreeZonePolicy, getPointValues } from './free-zone.policy.service.js';
import { checkFreeQuota, dhakaDayIndex, type PastFreeRequest } from './free-zone.rules.js';
import { averageRating, checkFreeSlot, checkRating, periodStart, pointsFor, type LeaderboardPeriod, type PointEvent } from './points.rules.js';

export type FzResult<T> =
  | { ok: true; data: T }
  | { ok: false; httpStatus: number; code: string; message: string };

const fail = (httpStatus: number, code: string, message: string): FzResult<never> => ({
  ok: false,
  httpStatus,
  code,
  message,
});

const CATEGORY_SLUG = 'free-consultation';
const DISABLED = () => fail(503, 'FREE_ZONE_DISABLED', 'ফ্রি জোন এখন সাময়িকভাবে বন্ধ আছে।');

async function pastFree(customerId: string): Promise<PastFreeRequest[]> {
  const rows = await getPrisma().serviceRequest.findMany({
    where: { customerId, serviceType: 'FREE_CONSULTATION', status: { notIn: ['CANCELLED', 'REJECTED'] } },
    select: { submittedAt: true, isEmergency: true },
    orderBy: { submittedAt: 'asc' },
  });
  return rows.map((r) => ({ at: r.submittedAt, emergency: r.isEmergency }));
}

/** Customer: current quota state (for the "can I ask?" banner). */
export async function getQuota(customerId: string) {
  const [policy, past] = await Promise.all([getFreeZonePolicy(), pastFree(customerId)]);
  const res = checkFreeQuota({ now: new Date(), policy, past, isEmergency: false });
  return {
    policy: { welcomeDays: policy.welcomeDays, welcomeLimit: policy.welcomeLimit, monthlyLimit: policy.monthlyLimit },
    canAsk: res.ok,
    ...(res.ok ? {} : { code: res.code, message: res.message, nextAvailableAt: res.nextAvailableAt.toISOString() }),
  };
}

export type SubmitInput = {
  animalId: string;
  symptoms: string;
  description?: string | undefined;
  isEmergency: boolean;
};

export async function submitFreeQuestion(customerId: string, userId: string, input: SubmitInput): Promise<FzResult<{ id: string }>> {
  const symptoms = input.symptoms.trim();
  if (symptoms.length < 5 || symptoms.length > 1000) return fail(422, 'VALIDATION_ERROR', 'উপসর্গ ৫ থেকে ১০০০ অক্ষরের মধ্যে লিখুন।');
  const prisma = getPrisma();
  const animal = await prisma.animalProfile.findFirst({ where: { id: input.animalId, customerId, active: true }, select: { id: true } });
  if (!animal) return fail(404, 'ANIMAL_NOT_FOUND', 'প্রাণীটি পাওয়া যায়নি।');
  const policy = await getFreeZonePolicy();
  if (!policy.enabled) return DISABLED();

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Serialise per customer so two parallel taps cannot both pass the quota.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`;
      const rows = await tx.serviceRequest.findMany({
        where: { customerId, serviceType: 'FREE_CONSULTATION', status: { notIn: ['CANCELLED', 'REJECTED'] } },
        select: { submittedAt: true, isEmergency: true },
      });
      const past: PastFreeRequest[] = rows.map((r) => ({ at: r.submittedAt, emergency: r.isEmergency }));
      const now = new Date();
      if (input.isEmergency && policy.emergencyExempt) {
        const today = past.filter((p) => p.emergency && dhakaDayIndex(p.at) === dhakaDayIndex(now)).length;
        if (today >= policy.emergencyDailyFree) {
          throw new QuotaError(
            'EMERGENCY_FREE_LIMIT',
            `আজকের ${policy.emergencyDailyFree}টি ফ্রি জরুরি অনুরোধ শেষ। এখন টাকার বিনিময়ে জরুরি ডাক্তার সেবা নিতে পারবেন।`,
          );
        }
      }
      const q = checkFreeQuota({ now, policy, past, isEmergency: input.isEmergency });
      if (!q.ok) throw new QuotaError(q.code, q.message, q.nextAvailableAt);

      const category = await tx.serviceCategory.upsert({
        where: { slug: CATEGORY_SLUG },
        create: { name: 'ফ্রি পরামর্শ', slug: CATEGORY_SLUG, description: 'Free Zone ফ্রি কনসালটেশন' },
        update: {},
        select: { id: true },
      });
      return tx.serviceRequest.create({
        data: {
          customerId,
          animalId: animal.id,
          serviceCategoryId: category.id,
          serviceType: 'FREE_CONSULTATION',
          status: 'PENDING',
          problemOrSymptom: symptoms,
          description: input.description?.trim() || null,
          isEmergency: input.isEmergency,
          priority: input.isEmergency ? 'EMERGENCY' : 'NORMAL',
          deliveryMode: 'ONLINE_CONSULTATION',
        },
        select: { id: true },
      });
    });
    await appendTimelineEvent({
      serviceRequestId: created.id,
      eventType: ServiceRequestEventType.CREATED,
      actorUserId: userId,
      actorRole: UserRole.CUSTOMER,
      note: null,
    });
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    if (err instanceof QuotaError) {
      return {
        ok: false,
        httpStatus: 429,
        code: err.code,
        message: err.message,
      };
    }
    throw err;
  }
}

class QuotaError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly nextAvailableAt?: Date,
  ) {
    super(message);
  }
}

/** Active doctor profile id for a partner user, or null. Free Zone answers are doctor-only. */
async function activeDoctorId(userId: string): Promise<string | null> {
  const d = await getPrisma().doctorProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } });
  return d?.providerStatus === 'ACTIVE' ? d.id : null;
}

/** Doctor: open free questions (no customer contact details). */
export async function listFreeQueue(userId: string): Promise<FzResult<{ items: unknown[] }>> {
  if (!(await getFreeZonePolicy()).enabled) return DISABLED();
  if (!(await activeDoctorId(userId))) return fail(403, 'NOT_ACTIVE', 'শুধু যাচাইকৃত সক্রিয় ডাক্তার ফ্রি কিউ দেখতে পারবেন।');
  const rows = await getPrisma().serviceRequest.findMany({
    where: { serviceType: 'FREE_CONSULTATION', status: 'PENDING', assignedDoctorId: null },
    orderBy: [{ isEmergency: 'desc' }, { submittedAt: 'asc' }],
    take: 30,
    select: {
      id: true,
      submittedAt: true,
      isEmergency: true,
      problemOrSymptom: true,
      animal: { select: { name: true, species: true, breed: true, dateOfBirth: true } },
    },
  });
  return {
    ok: true,
    data: {
      items: rows.map((r) => ({
        id: r.id,
        submittedAt: r.submittedAt.toISOString(),
        isEmergency: r.isEmergency,
        symptoms: r.problemOrSymptom,
        animal: r.animal ? { name: r.animal.name, species: r.animal.species, breed: r.animal.breed } : null,
      })),
    },
  };
}

/** Doctor: claim one free question. After this it flows through the normal partner-jobs accept/start/complete. */
export async function claimFree(userId: string, id: string): Promise<FzResult<{ id: string }>> {
  if (!(await getFreeZonePolicy()).enabled) return DISABLED();
  const doctorId = await activeDoctorId(userId);
  if (!doctorId) return fail(403, 'NOT_ACTIVE', 'শুধু যাচাইকৃত সক্রিয় ডাক্তার গ্রহণ করতে পারবেন।');
  const upd = await getPrisma().serviceRequest.updateMany({
    where: { id, serviceType: 'FREE_CONSULTATION', status: 'PENDING', assignedDoctorId: null },
    data: { assignedDoctorId: doctorId, status: 'ASSIGNED', assignedAt: new Date() },
  });
  if (upd.count === 0) return fail(409, 'ALREADY_TAKEN', 'অনুরোধটি অন্য ডাক্তার নিয়ে নিয়েছেন বা আর খোলা নেই।');
  await appendTimelineEvent({
    serviceRequestId: id,
    eventType: ServiceRequestEventType.ASSIGNED,
    actorUserId: userId,
    actorRole: UserRole.DOCTOR,
    note: null,
  });
  void notifyCustomer(id, 'ডাক্তার আপনার প্রশ্ন গ্রহণ করেছেন', 'আপনার ফ্রি পরামর্শের অনুরোধ একজন ডাক্তার গ্রহণ করেছেন।');
  return { ok: true, data: { id } };
}

/** Customer: own free questions with status, doctor name and whether already rated. */
export async function listMyQuestions(customerId: string) {
  const prisma = getPrisma();
  const rows = await prisma.serviceRequest.findMany({
    where: { customerId, serviceType: 'FREE_CONSULTATION' },
    orderBy: { submittedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      status: true,
      isEmergency: true,
      problemOrSymptom: true,
      submittedAt: true,
      assignedDoctorId: true,
      animal: { select: { name: true } },
    },
  });
  const docIds = [...new Set(rows.map((r) => r.assignedDoctorId).filter((x): x is string => !!x))];
  const [docs, reviews] = await Promise.all([
    prisma.doctorProfile.findMany({ where: { id: { in: docIds } }, select: { id: true, displayName: true } }),
    prisma.freeZoneReview.findMany({ where: { requestId: { in: rows.map((r) => r.id) } }, select: { requestId: true, rating: true } }),
  ]);
  const name = new Map(docs.map((d) => [d.id, d.displayName ?? 'ডাক্তার']));
  const rated = new Map(reviews.map((r) => [r.requestId, r.rating]));
  return {
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      isEmergency: r.isEmergency,
      symptoms: r.problemOrSymptom,
      submittedAt: r.submittedAt.toISOString(),
      animalName: r.animal?.name ?? '',
      doctorName: r.assignedDoctorId ? (name.get(r.assignedDoctorId) ?? 'ডাক্তার') : null,
      myRating: rated.get(r.id) ?? null,
    })),
  };
}

/** Idempotent points award; duplicate (user, event, ref) is silently ignored. */
export async function awardPoints(userId: string, event: PointEvent, refId: string): Promise<boolean> {
  try {
    await getPrisma().pointLedger.create({ data: { userId, eventType: event, refId, points: pointsFor(event, await getPointValues()) } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
}

export async function myPoints(userId: string) {
  const agg = await getPrisma().pointLedger.aggregate({ where: { userId }, _sum: { points: true } });
  return { total: agg._sum.points ?? 0 };
}

/** Customer: rate a completed free consultation (once per request); 5 stars awards the doctor points. */
export async function rateFree(customerId: string, id: string, rating: number, comment: string | undefined): Promise<FzResult<{ ok: true }>> {
  const prisma = getPrisma();
  const row = await prisma.serviceRequest.findUnique({
    where: { id },
    select: { customerId: true, status: true, serviceType: true, assignedDoctorId: true },
  });
  if (!row || row.serviceType !== 'FREE_CONSULTATION') return fail(404, 'NOT_FOUND', 'অনুরোধটি পাওয়া যায়নি।');
  const bad = checkRating({ rating, status: row.status, byRequestOwner: row.customerId === customerId });
  if (bad) return fail(422, 'INVALID_RATING', bad);
  if (!row.assignedDoctorId) return fail(409, 'NO_DOCTOR', 'এই অনুরোধে কোনো ডাক্তার নেই।');
  const doctor = await prisma.doctorProfile.findUnique({ where: { id: row.assignedDoctorId }, select: { userId: true } });
  if (!doctor) return fail(409, 'NO_DOCTOR', 'ডাক্তার পাওয়া যায়নি।');
  // FreeZoneReview.requestId is unique, so a request can be rated only once.
  try {
    await prisma.freeZoneReview.create({
      data: { requestId: id, customerId, doctorUserId: doctor.userId, rating, comment: comment?.trim() || null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return fail(409, 'ALREADY_RATED', 'আপনি আগেই রেটিং দিয়েছেন।');
    }
    throw err;
  }
  // Doctor-side record of the value (0 points) so averages can be computed from the ledger.
  await prisma.pointLedger.create({ data: { userId: doctor.userId, eventType: `RATING_${rating}`, refId: id, points: 0 } });
  if (rating === 5) await awardPoints(doctor.userId, 'FIVE_STAR_RATING', id);
  return { ok: true, data: { ok: true } };
}

/** Called after a free consultation is completed: award the doctor. */
export async function onFreeCompleted(doctorUserId: string, requestId: string): Promise<void> {
  await awardPoints(doctorUserId, 'FREE_CONSULTATION_COMPLETED', requestId);
  void notifyCustomer(requestId, 'পরামর্শ সম্পন্ন', 'আপনার ফ্রি পরামর্শ সম্পন্ন হয়েছে। অনুগ্রহ করে ডাক্তারকে রেটিং দিন।');
}

/** Fire-and-forget push to the request's customer (no-op when FCM is not configured). */
async function notifyCustomer(requestId: string, title: string, body: string): Promise<void> {
  try {
    const row = await getPrisma().serviceRequest.findUnique({
      where: { id: requestId },
      select: { customer: { select: { userId: true } } },
    });
    const uid = row?.customer?.userId;
    if (uid) await sendPushToUser(uid, { title, body, data: { type: 'FREE_CONSULTATION', requestId } });
  } catch {
    // push is best-effort
  }
}

// ---- free slots ----

export async function listMySlots(userId: string) {
  const rows = await getPrisma().partnerFreeSlot.findMany({
    where: { userId, endsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
    take: 100,
  });
  const counts = await bookedCounts(rows.map((r) => r.id));
  return rows.map((r) => slotView(r, undefined, counts.get(r.id) ?? 0));
}

/** Number of active (BOOKED) reservations per slot. */
async function bookedCounts(slotIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (slotIds.length === 0) return out;
  const g = await getPrisma().freeSlotBooking.groupBy({
    by: ['slotId'],
    where: { slotId: { in: slotIds }, status: 'BOOKED' },
    _count: { _all: true },
  });
  for (const r of g) out.set(r.slotId, r._count._all);
  return out;
}

type DoctorCard = {
  name: string;
  verified: boolean;
  degree: string | null;
  specialization: string | null;
  ratingAvg: number | null;
  ratingCount: number;
};

/** Public doctor info: `verified` is true only for admin-approved (ACTIVE) profiles. */
async function doctorCards(userIds: string[]): Promise<Map<string, DoctorCard>> {
  const prisma = getPrisma();
  const out = new Map<string, DoctorCard>();
  if (userIds.length === 0) return out;
  const [docs, ratings] = await Promise.all([
    prisma.doctorProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, displayName: true, providerStatus: true, degree: true, specialization: true },
    }),
    // Hidden (moderated) reviews are excluded from the public average.
    prisma.freeZoneReview.groupBy({
      by: ['doctorUserId', 'rating'],
      where: { doctorUserId: { in: userIds }, status: 'APPROVED' },
      _count: { _all: true },
    }),
  ]);
  for (const d of docs) {
    const r = averageRating(
      ratings.filter((x) => x.doctorUserId === d.userId).map((x) => ({ eventType: `RATING_${x.rating}`, count: x._count._all })),
    );
    out.set(d.userId, {
      name: d.displayName ?? 'ডাক্তার',
      verified: d.providerStatus === 'ACTIVE',
      degree: d.degree ?? null,
      specialization: d.specialization ?? null,
      ratingAvg: r.avg,
      ratingCount: r.count,
    });
  }
  return out;
}

export async function listPublicSlots(customerId?: string) {
  const rows = await getPrisma().partnerFreeSlot.findMany({
    where: { startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
    take: 50,
  });
  const ids = rows.map((r) => r.id);
  const [cards, counts, mine] = await Promise.all([
    doctorCards([...new Set(rows.map((r) => r.userId))]),
    bookedCounts(ids),
    customerId && ids.length
      ? getPrisma().freeSlotBooking.findMany({
          where: { customerId, status: 'BOOKED', slotId: { in: ids } },
          select: { slotId: true },
        })
      : Promise.resolve([] as { slotId: string }[]),
  ]);
  const mineSet = new Set(mine.map((m) => m.slotId));
  return rows.map((r) => ({
    ...slotView(r, cards.get(r.userId), counts.get(r.id) ?? 0),
    bookedByMe: mineSet.has(r.id),
  }));
}

type SlotRow = Awaited<ReturnType<ReturnType<typeof getPrisma>['partnerFreeSlot']['findMany']>>[number];
const slotView = (s: SlotRow, doctor?: DoctorCard, bookedCount = 0) => ({
  id: s.id,
  startsAt: s.startsAt.toISOString(),
  endsAt: s.endsAt.toISOString(),
  capacity: s.capacity,
  bookedCount,
  seatsLeft: Math.max(0, s.capacity - bookedCount),
  mode: s.mode,
  animalTypes: s.animalTypes,
  note: s.note,
  ...(doctor ? { doctor } : {}),
});

/** Doctor leaderboard for the current period (Dhaka). Top 10 plus the caller's own row. */
export async function leaderboard(userId: string, period: LeaderboardPeriod) {
  const prisma = getPrisma();
  const since = periodStart(period, new Date());
  const rows = await prisma.pointLedger.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: since }, points: { gt: 0 } },
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: 50,
  });
  const ranked = rows.map((r, i) => ({ userId: r.userId, points: r._sum.points ?? 0, rank: i + 1 }));
  const top = ranked.slice(0, 10);
  const names = await doctorCards(top.map((t) => t.userId));
  const mine = ranked.find((r) => r.userId === userId) ?? null;
  return {
    ok: true as const,
    data: {
      period,
      since: since.toISOString(),
      top: top.map((t) => ({
        rank: t.rank,
        points: t.points,
        name: names.get(t.userId)?.name ?? 'ডাক্তার',
        verified: names.get(t.userId)?.verified ?? false,
        isMe: t.userId === userId,
      })),
      me: mine ? { rank: mine.rank, points: mine.points } : null,
    },
  };
}

export async function createSlot(
  userId: string,
  input: { startsAt: Date; endsAt: Date; capacity: number; mode: string; animalTypes: string[]; note?: string | undefined },
): Promise<FzResult<ReturnType<typeof slotView>>> {
  if (!(await getFreeZonePolicy()).enabled) return DISABLED();
  if (!(await activeDoctorId(userId))) return fail(403, 'NOT_ACTIVE', 'শুধু যাচাইকৃত সক্রিয় ডাক্তার ফ্রি স্লট দিতে পারবেন।');
  const bad = checkFreeSlot(input, new Date());
  if (bad) return fail(422, 'INVALID_SLOT', bad);
  const prisma = getPrisma();
  const overlap = await prisma.partnerFreeSlot.findFirst({
    where: { userId, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } },
    select: { id: true },
  });
  if (overlap) return fail(409, 'OVERLAP', 'এই সময়ে আপনার আরেকটি ফ্রি স্লট আছে।');
  const row = await prisma.partnerFreeSlot.create({
    data: {
      userId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      mode: input.mode,
      animalTypes: input.animalTypes.slice(0, 10),
      note: input.note?.trim() || null,
    },
  });
  return { ok: true, data: slotView(row) };
}

export async function deleteSlot(userId: string, id: string): Promise<FzResult<{ id: string }>> {
  const r = await getPrisma().partnerFreeSlot.deleteMany({ where: { id, userId } });
  return r.count === 0 ? fail(404, 'NOT_FOUND', 'স্লট পাওয়া যায়নি।') : { ok: true, data: { id } };
}

// ---- slot booking ----

const BOOKING_NOT_FOUND = () => fail(404, 'NOT_FOUND', 'স্লট পাওয়া যায়নি।');

/** Customer reserves a seat in a doctor's free slot (serialised per slot so capacity can't be exceeded). */
export async function bookSlot(customerId: string, slotId: string): Promise<FzResult<{ slotId: string; startsAt: string }>> {
  if (!(await getFreeZonePolicy()).enabled) return DISABLED();
  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${slotId}))`;
    const slot = await tx.partnerFreeSlot.findUnique({ where: { id: slotId } });
    if (!slot) return BOOKING_NOT_FOUND();
    const now = new Date();
    const [bookedCount, existing, myUpcomingCount] = await Promise.all([
      tx.freeSlotBooking.count({ where: { slotId, status: 'BOOKED' } }),
      tx.freeSlotBooking.findUnique({ where: { slotId_customerId: { slotId, customerId } } }),
      tx.freeSlotBooking.count({ where: { customerId, status: 'BOOKED', slot: { startsAt: { gt: now } } } }),
    ]);
    const check = checkBooking({
      now,
      slotStartsAt: slot.startsAt,
      capacity: slot.capacity,
      bookedCount,
      alreadyBooked: existing?.status === 'BOOKED',
      myUpcomingCount,
    });
    if (!check.ok) return fail(409, check.code, check.message);
    if (existing) {
      await tx.freeSlotBooking.update({ where: { id: existing.id }, data: { status: 'BOOKED', cancelledAt: null } });
    } else {
      await tx.freeSlotBooking.create({ data: { slotId, customerId } });
    }
    return { ok: true as const, data: { slotId, startsAt: slot.startsAt.toISOString(), doctorUserId: slot.userId } };
  });
  if (!result.ok) return result;
  void sendPushToUser(result.data.doctorUserId, {
    title: 'নতুন স্লট বুকিং',
    body: 'একজন গ্রাহক আপনার ফ্রি স্লট বুক করেছেন।',
    data: { type: 'FREE_SLOT_BOOKED', slotId },
  }).catch(() => undefined);
  return { ok: true, data: { slotId: result.data.slotId, startsAt: result.data.startsAt } };
}

export async function cancelBooking(customerId: string, slotId: string): Promise<FzResult<{ slotId: string }>> {
  const prisma = getPrisma();
  const b = await prisma.freeSlotBooking.findUnique({
    where: { slotId_customerId: { slotId, customerId } },
    include: { slot: { select: { startsAt: true } } },
  });
  if (!b || b.status !== 'BOOKED') return fail(404, 'NOT_FOUND', 'বুকিং পাওয়া যায়নি।');
  if (!canCancelBooking(new Date(), b.slot.startsAt)) return fail(409, 'SLOT_STARTED', 'স্লট শুরু হয়ে গেছে, বাতিল করা যাবে না।');
  await prisma.freeSlotBooking.update({ where: { id: b.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  return { ok: true, data: { slotId } };
}

export async function listMyBookings(customerId: string) {
  const rows = await getPrisma().freeSlotBooking.findMany({
    where: { customerId, status: 'BOOKED', slot: { endsAt: { gte: new Date() } } },
    include: { slot: true },
    orderBy: { slot: { startsAt: 'asc' } },
    take: 20,
  });
  const cards = await doctorCards([...new Set(rows.map((r) => r.slot.userId))]);
  return {
    items: rows.map((r) => ({ bookingId: r.id, ...slotView(r.slot, cards.get(r.slot.userId)) })),
  };
}
