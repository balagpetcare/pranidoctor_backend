import type { MobileUserSettings } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export async function getOrCreateMobileUserSettings(userId: string): Promise<MobileUserSettings> {
  const existing = await prisma.mobileUserSettings.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.mobileUserSettings.create({ data: { userId } });
}
