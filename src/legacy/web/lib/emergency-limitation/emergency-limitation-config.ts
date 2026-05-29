import { prisma } from '@/lib/prisma';

import {
  DEFAULT_EMERGENCY_LIMITATION_CONFIG,
  EMERGENCY_LIMITATION_SETTING_KEY,
  parseEmergencyLimitationConfigJson,
  type EmergencyLimitationConfig,
} from './emergency-limitation-defaults.js';

export { EMERGENCY_LIMITATION_SETTING_KEY };

export async function loadEmergencyLimitationConfig(): Promise<EmergencyLimitationConfig> {
  const row = await prisma.setting.findUnique({
    where: { key: EMERGENCY_LIMITATION_SETTING_KEY },
    select: { valueJson: true },
  });
  if (row?.valueJson == null) {
    return { ...DEFAULT_EMERGENCY_LIMITATION_CONFIG };
  }
  return parseEmergencyLimitationConfigJson(row.valueJson);
}
