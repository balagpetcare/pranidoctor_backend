import { getPrisma } from '../../../shared/database/prisma.js';
import { getAiPlatformConfig } from '../config/ai.config.js';

export type AiUsageDimensions = {
  organizationId?: string;
  branchId?: string;
  clinicId?: string;
  doctorId?: string;
};

const doctorCache = new Map<string, string | null>();

export async function resolveUsageDimensions(userId?: string): Promise<AiUsageDimensions> {
  const config = getAiPlatformConfig();
  const dimensions: AiUsageDimensions = {};

  if (config.organizationId) dimensions.organizationId = config.organizationId;
  if (config.branchId) dimensions.branchId = config.branchId;

  if (!userId) return dimensions;

  let doctorId = doctorCache.get(userId);
  if (doctorId === undefined) {
    const profile = await getPrisma().doctorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    doctorId = profile?.id ?? null;
    doctorCache.set(userId, doctorId);
  }
  if (doctorId) dimensions.doctorId = doctorId;

  return dimensions;
}

export function clearUsageDimensionCacheForTests(): void {
  doctorCache.clear();
}

export const AI_USAGE_DIMENSION_TYPES = [
  'organization',
  'branch',
  'clinic',
  'doctor',
  'platform',
] as const;

export type AiUsageDimensionType = (typeof AI_USAGE_DIMENSION_TYPES)[number];
