import { NotificationType, type Prisma } from "../../../generated/prisma/client.js";

import {
  USER_SCOPED_SEED_TAG,
  daysAgo,
  hashSeed,
  pick,
  pickWeighted,
  stableId,
  type SeedResult,
  type SeedTx,
  type UserSeedContext,
} from "./faker.js";

function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedNotificationsForUser(
  tx: SeedTx,
  ctx: UserSeedContext,
): Promise<SeedResult> {
  let created = 0;
  let skipped = 0;
  const batch: Prisma.NotificationCreateManyInput[] = [];

  for (let i = 1; i <= ctx.counts.notifications; i++) {
    const id = stableId(ctx.idPrefix, "notif", i, 5);
    if (await tx.notification.findUnique({ where: { id }, select: { id: true } })) {
      skipped++;
      continue;
    }

    const rng = createRng(hashSeed(ctx.userId, "notif", String(i)));
    const read = rng() > 0.4;

    if (ctx.dryRun) {
      created++;
      continue;
    }

    batch.push({
      id,
      userId: ctx.userId,
      title: pick(rng, ["অ্যাপয়েন্টমেন্ট আপডেট", "পেমেন্ট", "নতুন বার্তা", "সিস্টেম"]),
      body: `Demo notification #${i} for user-scoped seed.`,
      type: pickWeighted(rng, [
        { value: NotificationType.REQUEST_UPDATE, weight: 3 },
        { value: NotificationType.PAYMENT, weight: 2 },
        { value: NotificationType.CHAT, weight: 2 },
        { value: NotificationType.SYSTEM, weight: 2 },
        { value: NotificationType.MARKETING, weight: 1 },
      ]),
      readAt: read ? daysAgo(rng, 14) : null,
      metadataJson: {
        channel: rng() > 0.5 ? "push" : "inapp",
        userScopedSeed: true,
        tag: USER_SCOPED_SEED_TAG,
      },
      createdAt: daysAgo(rng, 60),
    });

    if (batch.length >= 200) {
      await tx.notification.createMany({ data: batch, skipDuplicates: true });
      created += batch.length;
      batch.length = 0;
    }
  }

  if (!ctx.dryRun && batch.length > 0) {
    await tx.notification.createMany({ data: batch, skipDuplicates: true });
    created += batch.length;
  }

  return { created, skipped };
}

export async function clearNotificationsForUser(tx: SeedTx, idPrefix: string): Promise<number> {
  const result = await tx.notification.deleteMany({
    where: { id: { startsWith: `${idPrefix}-notif-` } },
  });
  return result.count;
}
