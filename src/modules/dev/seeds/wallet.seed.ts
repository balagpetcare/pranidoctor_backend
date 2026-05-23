import {
  FinanceType,
  IncomeSource,
  MobileUploadPurpose,
  Prisma,
  UploadedFileStatus,
} from "../../../generated/prisma/client.js";

import {
  USER_SCOPED_SEED_VERSION,
  daysAgo,
  hashSeed,
  walletSettingKey,
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

export async function seedWalletForUser(
  tx: SeedTx,
  ctx: UserSeedContext,
): Promise<SeedResult> {
  let created = 0;
  let skipped = 0;
  const rng = createRng(hashSeed(ctx.userId, "wallet"));
  const balance = Math.round(500 + rng() * 9500);

  if (!ctx.dryRun) {
    await tx.setting.upsert({
      where: { key: walletSettingKey(ctx.userId) },
      create: {
        key: walletSettingKey(ctx.userId),
        valueJson: {
          balanceBdt: balance,
          currency: "BDT",
          userScopedSeed: true,
          updatedAt: new Date().toISOString(),
        },
      },
      update: {
        valueJson: {
          balanceBdt: balance,
          currency: "BDT",
          userScopedSeed: true,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  for (let t = 0; t < ctx.counts.walletTransactions; t++) {
    const finId = stableId(ctx.idPrefix, "wallet", t + 1, 3);
    if (await tx.financeRecord.findUnique({ where: { id: finId }, select: { id: true } })) {
      skipped++;
      continue;
    }

    const isIncome = t % 2 === 0;
    if (ctx.dryRun) {
      created++;
      continue;
    }

    await tx.financeRecord.create({
      data: {
        id: finId,
        customerId: ctx.customerProfileId,
        type: isIncome ? FinanceType.INCOME : FinanceType.EXPENSE,
        amountBdt: new Prisma.Decimal((200 + rng() * 1800).toFixed(2)),
        recordedDate: daysAgo(rng, 90),
        source: isIncome ? IncomeSource.MILK_SALES : null,
        notes: `User-scoped wallet demo txn ${t + 1}`,
      },
    });
    created++;
  }

  return { created, skipped };
}

export async function seedMediaForUser(
  tx: SeedTx,
  ctx: UserSeedContext,
): Promise<SeedResult> {
  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= ctx.counts.mediaFiles; i++) {
    const id = stableId(ctx.idPrefix, "file", i);
    if (await tx.uploadedFile.findUnique({ where: { id }, select: { id: true } })) {
      skipped++;
      continue;
    }

    const rng = createRng(hashSeed(ctx.userId, "file", String(i)));
    const purpose =
      i % 3 === 0
        ? MobileUploadPurpose.CUSTOMER_COVER_IMAGE
        : MobileUploadPurpose.CUSTOMER_PROFILE_PHOTO;

    if (ctx.dryRun) {
      created++;
      continue;
    }

    await tx.uploadedFile.create({
      data: {
        id,
        ownerUserId: ctx.userId,
        bucket: "user-scoped-seed",
        storageKey: `user-scoped-seed/${USER_SCOPED_SEED_VERSION}/${ctx.userId}/${id}.jpg`,
        originalName: `${id}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 1024 + Math.floor(rng() * 8000),
        fileCategory: purpose,
        publicUrl: `/api/mobile/uploads/${id}`,
        status: UploadedFileStatus.ACTIVE,
      },
    });
    created++;
  }

  return { created, skipped };
}

export async function clearWalletForUser(
  tx: SeedTx,
  ctx: UserSeedContext,
): Promise<number> {
  await tx.setting.deleteMany({
    where: { key: walletSettingKey(ctx.userId) },
  });
  const result = await tx.financeRecord.deleteMany({
    where: { id: { startsWith: `${ctx.idPrefix}-wallet-` } },
  });
  return result.count;
}

export async function clearMediaForUser(tx: SeedTx, idPrefix: string): Promise<number> {
  const result = await tx.uploadedFile.deleteMany({
    where: { id: { startsWith: `${idPrefix}-file-` } },
  });
  return result.count;
}
