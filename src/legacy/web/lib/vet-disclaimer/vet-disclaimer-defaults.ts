/** Canonical veterinary disclaimer tiers — docs/compliance/veterinary/veterinary-disclaimer-plan.md */

export const VET_DISCLAIMER_SETTING_KEY = 'mobile.vet.disclaimer.config';

export type VetDisclaimerLocaleText = {
  en: string;
  bn: string;
};

export type VetDisclaimerContextKey =
  | 'bookingHome'
  | 'bookingEmergency'
  | 'bookingOnline'
  | 'treatmentJournal'
  | 'prescriptionView'
  | 'feedRation'
  | 'instantCare';

export type VetDisclaimerConfig = {
  /** Display metadata — acceptance version is legal.vetDisclaimerVersion */
  contentVersion: string;
  enforceAcceptance: boolean;
  /** V0 — platform banner */
  banner: VetDisclaimerLocaleText;
  /** V3 — emergency interstitial */
  emergency: VetDisclaimerLocaleText;
  /** V2 — full modal text */
  full: VetDisclaimerLocaleText;
  /** V1 — workflow-specific contextual */
  contextual: Record<VetDisclaimerContextKey, VetDisclaimerLocaleText>;
};

export const DEFAULT_VET_DISCLAIMER_BANNER: VetDisclaimerLocaleText = {
  en: 'Prani Doctor connects you with livestock professionals. Platform guidance does not replace hands-on veterinary examination.',
  bn: 'প্রাণী ডাক্তার আপনাকে পশুপালন পেশাদারদের সাথে সংযুক্ত করে। প্ল্যাটফর্ম নির্দেশনা সশরীরে প্রাণী চিকিৎসকের পরীক্ষার বিকল্প নয়।',
};

export const DEFAULT_VET_DISCLAIMER_EMERGENCY: VetDisclaimerLocaleText = {
  en: 'If your animal may die without immediate care, go to the nearest veterinary facility or call a vet now. Booking through the app does not guarantee emergency response time.',
  bn: 'জীবনঝুঁকি হলে অবিলম্বে নিকটস্থ প্রাণী চিকিৎসক বা ক্লিনিকে যোগাযোগ করুন। অ্যাপে বুকিং জরুরি সেবার সময় নিশ্চিত করে না।',
};

export const DEFAULT_VET_DISCLAIMER_FULL: VetDisclaimerLocaleText = {
  en: `Prani Doctor is a technology platform connecting farmers with licensed veterinarians and service providers. It is not a veterinary clinic or emergency service.

Only licensed veterinarians you book through the platform may examine animals and issue clinical decisions. Remote consultations depend on information you provide; your veterinarian may require an in-person visit.

You are responsible for accurate symptoms, history, and location. Do not delay professional care when your animal's condition worsens. Verify any guidance before medicating or changing rations.`,
  bn: `প্রাণী ডাক্তার কৃষক ও লাইসেন্সপ্রাপ্ত প্রাণী চিকিৎসক/সেবাদাতাদের সংযুক্ত করে — এটি ক্লিনিক বা জরুরি সেবা নয়।

শুধুমাত্র আপনি যে চিকিৎসক বুক করেন তিনি পরীক্ষা ও চিকিৎসা সিদ্ধান্ত নিতে পারেন। দূর পরামর্শ আপনার দেওয়া তথ্যের উপর নির্ভরশীল; সশরীরে পরিদর্শন প্রয়োজন হতে পারে।

সঠিক তথ্য দেওয়া এবং অবস্থা খারাপ হলে দেরি না করার দায়িত্ব আপনার। ওষুধ বা খাদ্য পরিবর্তনের আগে চিকিৎসকের পরামর্শ যাচাই করুন।`,
};

export const DEFAULT_VET_DISCLAIMER_CONTEXTUAL: Record<
  VetDisclaimerContextKey,
  VetDisclaimerLocaleText
> = {
  bookingHome: {
    en: 'Home visits are arranged through the platform; arrival time and clinical outcome are not guaranteed.',
    bn: 'বাড়িতে পরিদর্শন প্ল্যাটফর্মের মাধ্যমে — আগমনের সময় বা চিকিৎসা ফল নিশ্চিত নয়।',
  },
  bookingEmergency: {
    en: 'Emergency booking is a request for urgent care — not a guarantee of immediate response.',
    bn: 'জরুরি বুকিং তাত্ক্ষণিক সেবার নিশ্চয়তা দেয় না — এটি জরুরি সেবার অনুরোধ।',
  },
  bookingOnline: {
    en: 'Online consultation is based on the details you share. Your veterinarian may recommend an in-person visit. This is not for life-threatening emergencies.',
    bn: 'অনলাইন পরামর্শ আপনার তথ্যের উপর নির্ভরশীল; সশরীরে পরিদর্শন প্রয়োজন হতে পারে। জীবনঝুঁকির ক্ষেত্রে উপযুক্ত নয়।',
  },
  treatmentJournal: {
    en: 'Your entries are personal records, not verified by a veterinarian unless linked to a completed service visit.',
    bn: 'আপনার লেখা ব্যক্তিগত রেকর্ড; সম্পন্ন সেবা ছাড়া চিকিৎসক যাচাই করেননি।',
  },
  prescriptionView: {
    en: 'Follow prescription instructions from your attending veterinarian. Withdrawal periods and dosages must be verified professionally.',
    bn: 'উপস্থিত চিকিৎসকের নির্দেশ মেনে চলুন। ওষুধের মাত্রা ও প্রত্যাহার সময় পেশাদারভাবে যাচাই করুন।',
  },
  feedRation: {
    en: 'General feeding guidance — confirm with a veterinarian before medical dietary changes.',
    bn: 'সাধারণ খাদ্য নির্দেশনা — চিকিৎসা সংক্রান্ত পরিবর্তনে চিকিৎসকের পরামর্শ নিন।',
  },
  instantCare: {
    en: 'For life-threatening signs, contact a licensed veterinarian or emergency facility immediately — do not wait for the app.',
    bn: 'জীবনঝুঁকি লক্ষণে অবিলম্বে প্রাণী চিকিৎসক/জরুরি কেন্দ্রে যোগাযোগ করুন — অ্যাপের জন্য অপেক্ষা করবেন না।',
  },
};

export const DEFAULT_VET_DISCLAIMER_CONFIG: VetDisclaimerConfig = {
  contentVersion: '2026-05-30.1',
  enforceAcceptance: true,
  banner: DEFAULT_VET_DISCLAIMER_BANNER,
  emergency: DEFAULT_VET_DISCLAIMER_EMERGENCY,
  full: DEFAULT_VET_DISCLAIMER_FULL,
  contextual: {
    bookingHome: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingHome },
    bookingEmergency: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingEmergency },
    bookingOnline: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingOnline },
    treatmentJournal: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.treatmentJournal },
    prescriptionView: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.prescriptionView },
    feedRation: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.feedRation },
    instantCare: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.instantCare },
  },
};

function parseLocaleText(
  raw: unknown,
  fallback: VetDisclaimerLocaleText,
): VetDisclaimerLocaleText {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const o = raw as Record<string, unknown>;
  return {
    en: typeof o.en === 'string' && o.en.trim() ? o.en.trim() : fallback.en,
    bn: typeof o.bn === 'string' && o.bn.trim() ? o.bn.trim() : fallback.bn,
  };
}

export function parseVetDisclaimerConfigJson(j: unknown): VetDisclaimerConfig {
  if (j === null || typeof j !== 'object' || Array.isArray(j)) {
    return {
      ...DEFAULT_VET_DISCLAIMER_CONFIG,
      banner: { ...DEFAULT_VET_DISCLAIMER_BANNER },
      emergency: { ...DEFAULT_VET_DISCLAIMER_EMERGENCY },
      full: { ...DEFAULT_VET_DISCLAIMER_FULL },
      contextual: {
        bookingHome: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingHome },
        bookingEmergency: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingEmergency },
        bookingOnline: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingOnline },
        treatmentJournal: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.treatmentJournal },
        prescriptionView: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.prescriptionView },
        feedRation: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.feedRation },
        instantCare: { ...DEFAULT_VET_DISCLAIMER_CONTEXTUAL.instantCare },
      },
    };
  }
  const o = j as Record<string, unknown>;
  const contextualRaw =
    o.contextual !== null && typeof o.contextual === 'object' && !Array.isArray(o.contextual)
      ? (o.contextual as Record<string, unknown>)
      : {};

  return {
    contentVersion:
      typeof o.contentVersion === 'string' && o.contentVersion.trim()
        ? o.contentVersion.trim()
        : DEFAULT_VET_DISCLAIMER_CONFIG.contentVersion,
    enforceAcceptance:
      typeof o.enforceAcceptance === 'boolean'
        ? o.enforceAcceptance
        : DEFAULT_VET_DISCLAIMER_CONFIG.enforceAcceptance,
    banner: parseLocaleText(o.banner, DEFAULT_VET_DISCLAIMER_BANNER),
    emergency: parseLocaleText(o.emergency, DEFAULT_VET_DISCLAIMER_EMERGENCY),
    full: parseLocaleText(o.full, DEFAULT_VET_DISCLAIMER_FULL),
    contextual: {
      bookingHome: parseLocaleText(contextualRaw.bookingHome, DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingHome),
      bookingEmergency: parseLocaleText(
        contextualRaw.bookingEmergency,
        DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingEmergency,
      ),
      bookingOnline: parseLocaleText(
        contextualRaw.bookingOnline,
        DEFAULT_VET_DISCLAIMER_CONTEXTUAL.bookingOnline,
      ),
      treatmentJournal: parseLocaleText(
        contextualRaw.treatmentJournal,
        DEFAULT_VET_DISCLAIMER_CONTEXTUAL.treatmentJournal,
      ),
      prescriptionView: parseLocaleText(
        contextualRaw.prescriptionView,
        DEFAULT_VET_DISCLAIMER_CONTEXTUAL.prescriptionView,
      ),
      feedRation: parseLocaleText(
        contextualRaw.feedRation,
        DEFAULT_VET_DISCLAIMER_CONTEXTUAL.feedRation,
      ),
      instantCare: parseLocaleText(
        contextualRaw.instantCare,
        DEFAULT_VET_DISCLAIMER_CONTEXTUAL.instantCare,
      ),
    },
  };
}

export function vetDisclaimerConfigToSettingJson(
  config: VetDisclaimerConfig,
): Record<string, unknown> {
  return {
    contentVersion: config.contentVersion,
    enforceAcceptance: config.enforceAcceptance,
    banner: config.banner,
    emergency: config.emergency,
    full: config.full,
    contextual: config.contextual,
  };
}

export type VetDisclaimerLocale = 'en' | 'bn';

export function pickVetDisclaimerLocaleText(
  text: VetDisclaimerLocaleText,
  locale: VetDisclaimerLocale,
): string {
  return locale === 'bn' ? text.bn : text.en;
}
