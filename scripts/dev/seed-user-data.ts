/**
 * USER_SCOPED_TEST_DATA_GENERATOR_V1
 *
 * Generates realistic demo/test data for ONE existing user (by phone or userId).
 *
 * Run:
 *   npm run seed:user -- --phone=01701022200
 *   npm run seed:user -- --phone=01701022200 --count=50
 *   npm run seed:user -- --userId=cmpgq4t3j0000vobcl8jj6cbm
 *   npm run seed:user -- --phone=01701022200 --dry-run
 *   npm run seed:user -- --phone=01701022200 --clear
 */
import "dotenv/config";

import {
  Gender,
  MobileThemePreference,
  UserRole,
} from "../../src/generated/prisma/client.js";
import { disconnectPrisma, prisma } from "../../src/lib/prisma.js";
import { normalizeBdMobilePhone } from "../../src/modules/auth/phone.js";
import { clearAnimalsForUser, seedAnimalsForUser } from "../../src/modules/dev/seeds/animal.seed.js";
import {
  clearAppointmentsForUser,
  seedAppointmentsForUser,
} from "../../src/modules/dev/seeds/appointment.seed.js";
import { clearChatsForUser, seedChatsForUser } from "../../src/modules/dev/seeds/chat.seed.js";
import {
  dateOfBirthFromAgeYears,
  displayName,
  hashSeed,
  metaSettingKey,
  parseCliArgs,
  pick,
  placeholderAvatarUrl,
  placeholderFarmCoverUrl,
  resolveUserSeedCounts,
  USER_SCOPED_SEED_TAG,
  USER_SCOPED_SEED_VERSION,
  userSeedIdPrefix,
  type UserSeedContext,
  type SeedTx,
} from "../../src/modules/dev/seeds/faker.js";
import {
  clearNotificationsForUser,
  seedNotificationsForUser,
} from "../../src/modules/dev/seeds/notification.seed.js";
import {
  clearPrescriptionsForUser,
  seedPrescriptionsForUser,
} from "../../src/modules/dev/seeds/prescription.seed.js";
import {
  clearMediaForUser,
  clearWalletForUser,
  seedMediaForUser,
  seedWalletForUser,
} from "../../src/modules/dev/seeds/wallet.seed.js";

type TargetUser = {
  id: string;
  phone: string | null;
  email: string;
  customerProfile: {
    id: string;
    displayName: string;
  };
};

type SeedSummary = {
  animals: number;
  appointments: number;
  notifications: number;
  chatSessions: number;
  chatMessages: number;
  prescriptions: number;
  walletTransactions: number;
  mediaFiles: number;
};

function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function assertSafeToRun(): void {
  if (isProduction() && process.env.ALLOW_USER_SCOPED_SEED_IN_PRODUCTION !== "true") {
    console.error(
      "[seed:user] Aborted: NODE_ENV=production. Set ALLOW_USER_SCOPED_SEED_IN_PRODUCTION=true only on a disposable DB.",
    );
    process.exit(1);
  }
}

async function findTargetUser(opts: {
  phone?: string;
  userId?: string;
}): Promise<TargetUser | null> {
  if (opts.userId) {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: {
        id: true,
        phone: true,
        email: true,
        role: true,
        customerProfile: { select: { id: true, displayName: true } },
      },
    });
    if (!user) return null;
    if (user.role !== UserRole.CUSTOMER || !user.customerProfile) return null;
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      customerProfile: user.customerProfile,
    };
  }

  if (opts.phone) {
    const normalized = normalizeBdMobilePhone(opts.phone);
    if (!normalized) {
      console.error(`[seed:user] Invalid phone format: ${opts.phone}`);
      process.exit(1);
    }

    const candidates = [normalized, opts.phone.trim()];
    for (const phone of [...new Set(candidates)]) {
      const user = await prisma.user.findUnique({
        where: { phone },
        select: {
          id: true,
          phone: true,
          email: true,
          role: true,
          customerProfile: { select: { id: true, displayName: true } },
        },
      });
      if (!user) continue;
      if (user.role !== UserRole.CUSTOMER || !user.customerProfile) {
        console.error(
          `[seed:user] User with phone ${opts.phone} exists but has no customer profile.`,
        );
        process.exit(1);
      }
      return {
        id: user.id,
        phone: user.phone,
        email: user.email,
        customerProfile: user.customerProfile,
      };
    }
    return null;
  }

  return null;
}

async function assertPrerequisites(): Promise<{ doctorVisitId: string; emergencyId: string }> {
  const doctorVisit = await prisma.serviceCategory.findUnique({
    where: { slug: "doctor-visit" },
    select: { id: true },
  });
  const emergency = await prisma.serviceCategory.findUnique({
    where: { slug: "emergency" },
    select: { id: true },
  });
  if (!doctorVisit || !emergency) {
    console.error(
      "[seed:user] Missing service categories. Run `npm run db:seed` (or `db:seed:demo`) first.",
    );
    process.exit(1);
  }
  return { doctorVisitId: doctorVisit.id, emergencyId: emergency.id };
}

async function loadDoctorProfileIds(): Promise<string[]> {
  const doctors = await prisma.doctorProfile.findMany({
    select: { id: true },
    take: 10,
    orderBy: { createdAt: "asc" },
  });
  return doctors.map((d) => d.id);
}

async function clearUserScopedSeedData(ctx: UserSeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await clearPrescriptionsForUser(tx, ctx.idPrefix);
    await clearChatsForUser(tx, ctx.idPrefix);
    await clearNotificationsForUser(tx, ctx.idPrefix);
    await clearAppointmentsForUser(tx, ctx.idPrefix);
    await clearWalletForUser(tx, ctx);
    await clearMediaForUser(tx, ctx.idPrefix);
    await clearAnimalsForUser(tx, ctx.idPrefix);
    await tx.setting.deleteMany({ where: { key: metaSettingKey(ctx.userId) } });
  });
}

async function seedProfileCompletion(
  tx: SeedTx,
  ctx: UserSeedContext,
  displayNameSeed: string,
): Promise<void> {
  if (ctx.dryRun) return;

  const rng = createRng(hashSeed(ctx.userId, "profile"));
  const completeProfile = rng() > 0.35;
  const locale = rng() > 0.25 ? "bn-BD" : "en-US";
  const gender = pick(rng, [Gender.MALE, Gender.FEMALE, Gender.OTHER, Gender.UNKNOWN]);

  const existing = await tx.customerProfile.findUnique({
    where: { id: ctx.customerProfileId },
    select: { addressJson: true },
  });
  const prev =
    existing?.addressJson && typeof existing.addressJson === "object"
      ? (existing.addressJson as Record<string, unknown>)
      : {};

  await tx.customerProfile.update({
    where: { id: ctx.customerProfileId },
    data: {
      displayName: displayNameSeed,
      locale,
      profilePhotoUrl: rng() > 0.25 ? placeholderAvatarUrl(`u-${ctx.userId}`) : null,
      profilePhotoThumbUrl:
        rng() > 0.35 ? placeholderAvatarUrl(`u-${ctx.userId}-thumb`) : null,
      coverPhotoUrl: rng() > 0.45 ? placeholderFarmCoverUrl(`cover-${ctx.userId}`) : null,
      profileCompletedAt: completeProfile ? new Date() : null,
      addressJson: {
        ...prev,
        userScopedSeed: true,
        areaLabel: completeProfile ? "Demo farm area (seed only)" : null,
        gender: rng() > 0.2 ? gender : null,
        dateOfBirth:
          rng() > 0.3
            ? dateOfBirthFromAgeYears(rng, 22 + Math.floor(rng() * 40)).toISOString()
            : null,
        bio:
          rng() > 0.4 ? "Demo livestock farmer profile (user-scoped seed)." : null,
        preferences: {
          notifications: rng() > 0.15,
          marketing: rng() > 0.7,
          language: locale,
          theme: pick(rng, ["system", "light", "dark"]),
        },
      },
    },
  });

  if (rng() > 0.3) {
    await tx.mobileUserSettings.upsert({
      where: { userId: ctx.userId },
      create: {
        userId: ctx.userId,
        theme: pick(rng, [
          MobileThemePreference.SYSTEM,
          MobileThemePreference.LIGHT,
          MobileThemePreference.DARK,
        ]),
        locale,
        privacyAcceptedVersion: completeProfile ? "2026-05-01" : null,
        privacyAcceptedAt: completeProfile ? new Date() : null,
        termsAcceptedVersion: completeProfile ? "2026-05-01" : null,
        termsAcceptedAt: completeProfile ? new Date() : null,
      },
      update: {
        theme: pick(rng, [
          MobileThemePreference.SYSTEM,
          MobileThemePreference.LIGHT,
          MobileThemePreference.DARK,
        ]),
        locale,
      },
    });
  }
}

async function runSeed(ctx: UserSeedContext): Promise<SeedSummary> {
  const summary: SeedSummary = {
    animals: 0,
    appointments: 0,
    notifications: 0,
    chatSessions: 0,
    chatMessages: 0,
    prescriptions: 0,
    walletTransactions: 0,
    mediaFiles: 0,
  };

  await prisma.$transaction(async (tx) => {
    const rng = createRng(hashSeed(ctx.userId, "profile"));
    await seedProfileCompletion(tx, ctx, displayName(rng, 1));

    const animals = await seedAnimalsForUser(tx, ctx);
    summary.animals = animals.created;

    const appointments = await seedAppointmentsForUser(tx, ctx);
    summary.appointments = appointments.created;

    const notifications = await seedNotificationsForUser(tx, ctx);
    summary.notifications = notifications.created;

    const chats = await seedChatsForUser(tx, ctx);
    summary.chatSessions = chats.created;
    summary.chatMessages = chats.messagesCreated;

    const prescriptions = await seedPrescriptionsForUser(tx, ctx);
    summary.prescriptions = prescriptions.created;

    const wallet = await seedWalletForUser(tx, ctx);
    summary.walletTransactions = wallet.created;

    const media = await seedMediaForUser(tx, ctx);
    summary.mediaFiles = media.created;

    if (!ctx.dryRun) {
      await tx.setting.upsert({
        where: { key: metaSettingKey(ctx.userId) },
        create: {
          key: metaSettingKey(ctx.userId),
          valueJson: {
            tag: USER_SCOPED_SEED_TAG,
            version: USER_SCOPED_SEED_VERSION,
            userId: ctx.userId,
            idPrefix: ctx.idPrefix,
            seededAt: new Date().toISOString(),
            counts: ctx.counts,
          },
        },
        update: {
          valueJson: {
            tag: USER_SCOPED_SEED_TAG,
            version: USER_SCOPED_SEED_VERSION,
            userId: ctx.userId,
            idPrefix: ctx.idPrefix,
            seededAt: new Date().toISOString(),
            counts: ctx.counts,
          },
        },
      });
    }
  });

  return summary;
}

function printUsage(): void {
  console.info(`
Usage:
  npm run seed:user -- --phone=01701022200
  npm run seed:user -- --phone=01701022200 --count=50
  npm run seed:user -- --userId=<cuid>
  npm run seed:user -- --phone=01701022200 --dry-run
  npm run seed:user -- --phone=01701022200 --clear

Options:
  --phone=...    Target user by Bangladesh mobile
  --userId=...   Target user by ID (provide one of phone or userId)
  --count=...    Scale: 25=small, 50=medium, 100=large (default presets when omitted)
  --dry-run      Preview counts without writing
  --clear        Remove previously seeded demo data for this user only
`);
}

async function main(): Promise<void> {
  assertSafeToRun();
  const startedAt = Date.now();

  let cli: ReturnType<typeof parseCliArgs>;
  try {
    cli = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[seed:user] ${err instanceof Error ? err.message : String(err)}`);
    printUsage();
    process.exit(1);
  }

  if (!cli.phone && !cli.userId) {
    console.error("[seed:user] Provide --phone=... or --userId=...");
    printUsage();
    process.exit(1);
  }

  const user = await findTargetUser({ phone: cli.phone, userId: cli.userId });
  if (!user) {
    const label = cli.userId ? `userId=${cli.userId}` : `phone=${cli.phone}`;
    console.error(`[seed:user] No customer user found for ${label}.`);
    process.exit(1);
  }

  const counts = resolveUserSeedCounts(cli.count);
  const idPrefix = userSeedIdPrefix(user.id);
  const { doctorVisitId, emergencyId } = await assertPrerequisites();
  const doctorProfileIds = await loadDoctorProfileIds();

  const ctx: UserSeedContext = {
    userId: user.id,
    customerProfileId: user.customerProfile.id,
    idPrefix,
    counts,
    serviceCategoryId: doctorVisitId,
    emergencyCategoryId: emergencyId,
    doctorProfileIds,
    animalIds: [],
    serviceRequestIds: [],
    dryRun: cli.dryRun,
  };

  console.info("[seed:user] USER_SCOPED_TEST_DATA_GENERATOR_V1");
  console.info("[seed:user] target:", {
    userId: user.id,
    phone: user.phone,
    email: user.email,
    displayName: user.customerProfile.displayName,
  });
  console.info("[seed:user] counts:", counts);
  if (cli.dryRun) console.info("[seed:user] mode: dry-run (no writes)");
  if (cli.clear) console.info("[seed:user] mode: clear then seed");

  try {
    if (cli.clear && !cli.dryRun) {
      await clearUserScopedSeedData(ctx);
      console.info("[seed:user] cleared previous user-scoped seed data");
    }

    const summary = await runSeed(ctx);
    const durationMs = Date.now() - startedAt;

    console.info("");
    console.info("Seed Summary:");
    console.info(`  User:           ${user.customerProfile.displayName} (${user.id})`);
    console.info(`  Animals:        ${summary.animals}${cli.dryRun ? " (planned)" : ""}`);
    console.info(`  Appointments:   ${summary.appointments}${cli.dryRun ? " (planned)" : ""}`);
    console.info(`  Notifications:  ${summary.notifications}${cli.dryRun ? " (planned)" : ""}`);
    console.info(
      `  Chats:          ${summary.chatSessions} sessions, ${summary.chatMessages} messages${cli.dryRun ? " (planned)" : ""}`,
    );
    console.info(`  Prescriptions:  ${summary.prescriptions}${cli.dryRun ? " (planned)" : ""}`);
    console.info(
      `  Wallet txns:    ${summary.walletTransactions}${cli.dryRun ? " (planned)" : ""}`,
    );
    console.info(`  Media refs:     ${summary.mediaFiles}${cli.dryRun ? " (planned)" : ""}`);
    console.info(`  Duration:       ${(durationMs / 1000).toFixed(2)}s`);
  } catch (err) {
    console.error("[seed:user] Failed — transaction rolled back.");
    console.error(err);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma();
  process.exit(1);
});
