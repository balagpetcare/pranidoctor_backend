import { prisma } from '@/lib/prisma';

import {
  DEFAULT_LEGAL,
  LEGAL_SETTING_KEY,
  parseLegalConfigJson,
  type LegalConfig,
} from './legal-defaults.js';

export async function loadLegalConfig(): Promise<LegalConfig> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: LEGAL_SETTING_KEY },
      select: { valueJson: true },
    });
    if (row?.valueJson != null) {
      return parseLegalConfigJson(row.valueJson);
    }
  } catch {
    /* optional */
  }
  return { ...DEFAULT_LEGAL };
}

export type { LegalConfig };
