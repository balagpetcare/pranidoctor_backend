import { prisma } from '@/lib/prisma';

import {
  DEFAULT_VET_DISCLAIMER_CONFIG,
  parseVetDisclaimerConfigJson,
  type VetDisclaimerConfig,
  VET_DISCLAIMER_SETTING_KEY,
} from './vet-disclaimer-defaults.js';

export async function loadVetDisclaimerConfig(): Promise<VetDisclaimerConfig> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: VET_DISCLAIMER_SETTING_KEY },
      select: { valueJson: true },
    });
    if (row?.valueJson != null) {
      return parseVetDisclaimerConfigJson(row.valueJson);
    }
  } catch {
    /* optional */
  }
  return {
    ...DEFAULT_VET_DISCLAIMER_CONFIG,
    banner: { ...DEFAULT_VET_DISCLAIMER_CONFIG.banner },
    emergency: { ...DEFAULT_VET_DISCLAIMER_CONFIG.emergency },
    full: { ...DEFAULT_VET_DISCLAIMER_CONFIG.full },
    contextual: {
      bookingHome: { ...DEFAULT_VET_DISCLAIMER_CONFIG.contextual.bookingHome },
      bookingEmergency: { ...DEFAULT_VET_DISCLAIMER_CONFIG.contextual.bookingEmergency },
      bookingOnline: { ...DEFAULT_VET_DISCLAIMER_CONFIG.contextual.bookingOnline },
      treatmentJournal: { ...DEFAULT_VET_DISCLAIMER_CONFIG.contextual.treatmentJournal },
      prescriptionView: { ...DEFAULT_VET_DISCLAIMER_CONFIG.contextual.prescriptionView },
      feedRation: { ...DEFAULT_VET_DISCLAIMER_CONFIG.contextual.feedRation },
      instantCare: { ...DEFAULT_VET_DISCLAIMER_CONFIG.contextual.instantCare },
    },
  };
}

export { VET_DISCLAIMER_SETTING_KEY };
