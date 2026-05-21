import { prisma } from "@/lib/prisma";

/**
 * OTP/mobile users can authenticate before a `CustomerProfile` row exists.
 * Creates a minimal profile (Bengali placeholder display name) so `/api/mobile/me`
 * and AI technician onboarding routes work without extra client steps.
 */
export async function ensureMinimalCustomerProfile(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) {
    throw new Error("ensureMinimalCustomerProfile: user not found");
  }

  const phone = user.phone?.trim();
  const displayName =
    (phone != null && phone.length >= 4 ? `ব্যবহারকারী ${phone.slice(-4)}` : null) ??
    (user.email.includes("@") ? user.email.split("@")[0]!.trim().slice(0, 120) : null) ??
    "ব্যবহারকারী";

  const row = await prisma.customerProfile.upsert({
    where: { userId },
    create: { userId, displayName },
    update: {},
    select: { id: true },
  });

  return row.id;
}
