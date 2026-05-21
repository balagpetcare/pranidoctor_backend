/**
 * Upserts a single panel admin user from environment variables only.
 * Run: npm run seed:admin
 *
 * Requires DATABASE_URL. Reads ADMIN_SEED_* (see docs/ADMIN_CREDENTIAL_SETUP.md).
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import { UserRole, UserStatus } from "../src/generated/prisma/client";
import { disconnectPrisma, prisma } from "../src/lib/prisma";

/** Bcrypt cost — must match admin login (`bcrypt.compare` in `/api/admin/auth/login`). */
const BCRYPT_COST = 12;

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function normalizePanelEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function main(): Promise<void> {
  const email = normalizePanelEmail(requireEnv("ADMIN_SEED_EMAIL"));
  const password = requireEnv("ADMIN_SEED_PASSWORD");
  const displayName =
    optionalEnv("ADMIN_SEED_NAME") ?? "Prani Doctor Admin";
  const phoneRaw = optionalEnv("ADMIN_SEED_PHONE");
  const phone = phoneRaw ?? null;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (
    existing &&
    existing.role !== UserRole.ADMIN &&
    existing.role !== UserRole.SUPER_ADMIN
  ) {
    console.warn(
      `[seed:admin] Skipped: ${email} already exists with role ${existing.role} (not an admin role).`,
    );
    return;
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);
  const targetRole =
    existing?.role === UserRole.SUPER_ADMIN
      ? UserRole.SUPER_ADMIN
      : UserRole.ADMIN;

  const adminUser = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      phone,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      role: targetRole,
      ...(phone !== null ? { phone } : {}),
    },
  });

  await prisma.adminProfile.upsert({
    where: { userId: adminUser.id },
    create: {
      userId: adminUser.id,
      displayName,
    },
    update: {
      displayName,
    },
  });

  console.info(
    `[seed:admin] Panel admin upserted for email: ${adminUser.email} (role: ${targetRole}, password not logged).`,
  );
}

main()
  .then(async () => {
    await disconnectPrisma();
  })
  .catch(async (e: unknown) => {
    console.error("[seed:admin] Failed:", e instanceof Error ? e.message : e);
    await disconnectPrisma();
    process.exit(1);
  });
