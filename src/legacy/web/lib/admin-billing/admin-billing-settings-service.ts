import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_SETTING_KEY,
  getPlatformCommissionRate,
  resolvePlatformCommissionRate,
} from "@/lib/platform-commission-rate";

export type AdminBillingSettingsDto = {
  /** Stored fraction 0–1 (same as runtime billing calculations). */
  commissionRate: number;
  /** Whole percent 0–100 for admin UI. */
  commissionPercent: number;
  explanation: string;
};

const EXPLANATION =
  "Platform commission applies mainly to the service fee amount (after discount allocated to the service component). Medicine cost and travel cost are not included in the commission base by default.";

export async function getAdminBillingSettings(): Promise<AdminBillingSettingsDto> {
  const row = await prisma.setting.findUnique({
    where: { key: PLATFORM_COMMISSION_SETTING_KEY },
    select: { valueJson: true },
  });
  const commissionRate = resolvePlatformCommissionRate(row?.valueJson);
  return {
    commissionRate,
    commissionPercent: Math.round(commissionRate * 10000) / 100,
    explanation: EXPLANATION,
  };
}

export async function updateAdminBillingSettings(
  commissionPercent: number,
): Promise<AdminBillingSettingsDto> {
  const commissionRate = Math.round((commissionPercent / 100) * 10000) / 10000;

  await prisma.setting.upsert({
    where: { key: PLATFORM_COMMISSION_SETTING_KEY },
    create: {
      key: PLATFORM_COMMISSION_SETTING_KEY,
      valueJson: { rate: commissionRate },
    },
    update: {
      valueJson: { rate: commissionRate },
    },
  });

  const verify = await getPlatformCommissionRate(prisma);
  const effectiveRate =
    Number.isFinite(verify) && verify >= 0 ? verify : DEFAULT_PLATFORM_COMMISSION_RATE;

  return {
    commissionRate: effectiveRate,
    commissionPercent: Math.round(effectiveRate * 10000) / 100,
    explanation: EXPLANATION,
  };
}
