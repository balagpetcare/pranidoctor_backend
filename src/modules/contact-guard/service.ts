import { getPrisma } from '../../shared/database/prisma.js';
import { CONTACT_INFO_NOT_ALLOWED, scanDeep, scanText, type ContactFinding } from './detect.js';

export const MAX_STRIKES = 3;

export type ViolationSource =
  | 'PARTNER_SERVICE'
  | 'AI_SERVICE'
  | 'SERVICE_INSTANCE'
  | 'PRESCRIPTION'
  | 'PROFILE'
  | 'AI_CHAT'
  | 'USER_CHAT'
  | 'IMAGE';

export type GuardOutcome = {
  blocked: true;
  code: typeof CONTACT_INFO_NOT_ALLOWED;
  strike: number;
  maxStrikes: number;
  suspended: boolean;
  messageBn: string;
};

export function warningMessageBn(strike: number, suspended: boolean): string {
  if (suspended) {
    return 'ব্যক্তিগত যোগাযোগ তথ্য বারবার দেওয়ায় আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে। আপনার সার্ভিস ও ব্যালেন্স উত্তোলন বন্ধ আছে। অ্যাডমিন পর্যালোচনার পর সিদ্ধান্ত জানানো হবে।';
  }
  if (strike === 2) {
    return 'চূড়ান্ত সতর্কতা: মোবাইল, হোয়াটসঅ্যাপ, ইমো বা ইমেইল দেওয়া নিষিদ্ধ। আরেকবার করলে আপনার অ্যাকাউন্ট স্থগিত হবে।';
  }
  return 'সতর্কতা: সার্ভিস, বিবরণ বা প্রেসক্রিপশনে ব্যক্তিগত ফোন/হোয়াটসঅ্যাপ/ইমো/ইমেইল দেওয়া নিষিদ্ধ। যোগাযোগ শুধু অ্যাপের মাধ্যমে করুন।';
}

type Db = ReturnType<typeof getPrisma>;

async function currentStrikes(db: Db, userId: string): Promise<number> {
  return db.contactViolation.count({ where: { userId, status: { in: ['OPEN', 'CONFIRMED'] } } });
}

export async function suspendForContactViolations(db: Db, userId: string, reason: string): Promise<void> {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } }),
    db.doctorProfile.updateMany({ where: { userId }, data: { providerStatus: 'SUSPENDED' } }),
    db.aiTechnicianProfile.updateMany({ where: { userId }, data: { providerStatus: 'SUSPENDED' } }),
    db.userSession.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason },
    }),
  ]);
}

export async function recordContactViolation(input: {
  userId: string;
  source: ViolationSource;
  field?: string;
  entityType?: string;
  entityId?: string;
  findings: ContactFinding[];
  imageUrl?: string;
  needsReview?: boolean;
}): Promise<GuardOutcome> {
  const db = getPrisma();
  const prior = await currentStrikes(db, input.userId);
  const strike = Math.min(prior + 1, MAX_STRIKES);
  const suspended = strike >= MAX_STRIKES;

  await db.contactViolation.create({
    data: {
      userId: input.userId,
      source: input.source,
      field: input.field ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      kinds: input.findings.map((f) => f.kind),
      samples: input.findings.map((f) => f.sample),
      imageUrl: input.imageUrl ?? null,
      strikeNo: strike,
      status: input.needsReview ? 'PENDING_REVIEW' : 'OPEN',
    },
  });

  const messageBn = warningMessageBn(strike, suspended);
  await db.notification.create({
    data: {
      userId: input.userId,
      title: suspended ? 'অ্যাকাউন্ট স্থগিত' : strike === 2 ? 'চূড়ান্ত সতর্কতা' : 'সতর্কতা',
      body: messageBn,
      type: 'SYSTEM',
      metadataJson: { code: CONTACT_INFO_NOT_ALLOWED, strike, source: input.source },
    },
  });

  if (suspended) await suspendForContactViolations(db, input.userId, 'CONTACT_GUARD_3_STRIKES');

  return { blocked: true, code: CONTACT_INFO_NOT_ALLOWED, strike, maxStrikes: MAX_STRIKES, suspended, messageBn };
}

/** Scan fields; on hit record a strike and return the outcome, else null. */
export async function guardFields(
  userId: string,
  source: ViolationSource,
  fields: Record<string, unknown>,
  ctx: { entityType?: string; entityId?: string } = {},
): Promise<GuardOutcome | null> {
  for (const [field, value] of Object.entries(fields)) {
    const r = typeof value === 'string' ? scanText(value) : scanDeep(value);
    if (r.hit) {
      return recordContactViolation({ userId, source, field, findings: r.findings, ...ctx });
    }
  }
  return null;
}

/** Image path: OCR text if available, else queue for manual review. */
export async function guardImageText(
  userId: string,
  imageUrl: string,
  ocrText: string | null,
  ctx: { entityType?: string; entityId?: string } = {},
): Promise<GuardOutcome | null> {
  if (ocrText === null) return null; // OCR unavailable: caller enqueues PENDING_REVIEW separately
  const r = scanText(ocrText);
  if (!r.hit) return null;
  const out = await recordContactViolation({ userId, source: 'IMAGE', field: 'image', findings: r.findings, imageUrl, ...ctx });
  const db = getPrisma();
  // Remove verification ID/documents for image violations (soft flag; admin restores on dismiss).
  await db.contactViolation.updateMany({ where: { userId, imageUrl }, data: { verificationRemoved: true } });
  return out;
}

export async function reviewViolation(id: string, adminUserId: string, action: 'DISMISS' | 'CONFIRM' | 'RESTORE', note?: string) {
  const db = getPrisma();
  const v = await db.contactViolation.findUnique({ where: { id } });
  if (!v) return null;
  const status = action === 'DISMISS' ? 'DISMISSED' : action === 'CONFIRM' ? 'CONFIRMED' : 'DISMISSED';
  const updated = await db.contactViolation.update({
    where: { id },
    data: { status, reviewedById: adminUserId, reviewedAt: new Date(), reviewNote: note ?? null },
  });
  if (action === 'CONFIRM') {
    const strikes = await currentStrikes(db, v.userId);
    if (strikes >= MAX_STRIKES) await suspendForContactViolations(db, v.userId, 'CONTACT_GUARD_ADMIN_CONFIRM');
  }
  if (action === 'RESTORE') {
    const strikes = await currentStrikes(db, v.userId);
    if (strikes < MAX_STRIKES) {
      await db.$transaction([
        db.user.update({ where: { id: v.userId }, data: { status: 'ACTIVE' } }),
        db.doctorProfile.updateMany({ where: { userId: v.userId, providerStatus: 'SUSPENDED' }, data: { providerStatus: 'ACTIVE' } }),
        db.aiTechnicianProfile.updateMany({ where: { userId: v.userId, providerStatus: 'SUSPENDED' }, data: { providerStatus: 'ACTIVE' } }),
      ]);
    }
  }
  return updated;
}

export async function listViolations(q: { status?: string; userId?: string; source?: string; q?: string; take?: number; skip?: number }) {
  const db = getPrisma();
  const where = { ...(q.status ? { status: q.status } : {}), ...(q.userId ? { userId: q.userId } : {}), ...(q.source ? { source: q.source } : {}), ...(q.q ? { userId: { contains: q.q } } : {}) };
  const [rows, total] = await Promise.all([
    db.contactViolation.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(q.take ?? 25, 100), skip: q.skip ?? 0 }),
    db.contactViolation.count({ where }),
  ]);
  return { rows, total };
}
