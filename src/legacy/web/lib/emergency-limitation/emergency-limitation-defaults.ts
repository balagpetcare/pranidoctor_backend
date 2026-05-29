/** Canonical emergency limitation tiers — docs/compliance/emergency/emergency-service-limitation-plan.md */

export const EMERGENCY_LIMITATION_SETTING_KEY = 'mobile.emergency.limitation.config';

export type EmergencyLimitationLocaleText = {
  en: string;
  bn: string;
};

export type EmergencyLimitationContextKey =
  | 'instantCare'
  | 'aiEmergency'
  | 'bookingEmergency'
  | 'discoveryEmergency'
  | 'requestPending'
  | 'bookingOnline'
  | 'phoneDial';

export type EmergencyLimitationConfig = {
  contentVersion: string;
  enforceAcceptance: boolean;
  /** U0 — platform banner */
  banner: EmergencyLimitationLocaleText;
  /** U1 — urgent interstitial */
  urgent: EmergencyLimitationLocaleText;
  /** U3 — full modal / first emergency acceptance */
  full: EmergencyLimitationLocaleText;
  /** U2 — workflow-specific contextual */
  contextual: Record<EmergencyLimitationContextKey, EmergencyLimitationLocaleText>;
};

export const DEFAULT_EMERGENCY_LIMITATION_BANNER: EmergencyLimitationLocaleText = {
  en: 'Prani Doctor is a technology platform, not an emergency veterinary service or ambulance dispatch.',
  bn: 'প্রাণী ডাক্তার একটি প্রযুক্তি প্ল্যাটফর্ম — জরুরি প্রাণী চিকিৎসা বা অ্যাম্বুলেন্স সেবা নয়।',
};

export const DEFAULT_EMERGENCY_LIMITATION_URGENT: EmergencyLimitationLocaleText = {
  en: 'This app does not send emergency veterinary teams. If life is at risk, contact a veterinarian or clinic immediately.',
  bn: 'অ্যাপ জরুরি দল পাঠায় না। জীবনঝুঁকি হলে অবিলম্বে প্রাণী চিকিৎসক বা ক্লিনিকে যোগাযোগ করুন।',
};

export const DEFAULT_EMERGENCY_LIMITATION_FULL: EmergencyLimitationLocaleText = {
  en: `Prani Doctor connects farmers with licensed veterinarians. It is not an emergency medical service, ambulance system, or 24/7 clinic.

Emergency doctor booking creates a request reviewed by our team — it does not guarantee immediate response, assignment, or arrival. Doctors listed as accepting emergency visits may not be available right now.

AI urgency labels are based on your description only — they do not dispatch help or confirm an emergency.

You are responsible for seeking immediate in-person care when your animal's condition is critical. Do not delay care while waiting for the app, AI, assignment, or support.`,
  bn: `প্রাণী ডাক্তার কৃষক ও লাইসেন্সপ্রাপ্ত প্রাণী চিকিৎসককে সংযুক্ত করে — এটি জরুরি চিকিৎসা, অ্যাম্বুলেন্স বা ২৪/৭ ক্লিনিক নয়।

জরুরি ডাক্তার বুকিং একটি অনুরোধ — তাত্ক্ষণিক উত্তর, অ্যাসাইনমেন্ট বা আগমন নিশ্চিত করে না। জরুরি সেবা গ্রহণকারী চিকিৎসক এখনই খালি থাকতে পারেন।

AI-এর জরুরি লেবেল আপনার বর্ণনার উপর — সেটা সাহায্য পাঠায় না।

গুরুতর অবস্থায় দেরি না করে স্থানীয় চিকিৎসা নেওয়ার দায়িত্ব আপনার।`,
};

export const DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL: Record<
  EmergencyLimitationContextKey,
  EmergencyLimitationLocaleText
> = {
  instantCare: {
    en: 'Instant care options connect you to services or phone numbers — they do not guarantee emergency response.',
    bn: 'তাত্ক্ষণিক সেবা বিকল্প সংযোগ দেয় — জরুরি সাড়া নিশ্চিত করে না।',
  },
  aiEmergency: {
    en: 'AI flagged possible urgency from your text — it does not dispatch a veterinarian. Seek local care if life is at risk.',
    bn: 'AI আপনার লেখা থেকে সম্ভাব্য জরুরি চিহ্নিত করেছে — চিকিৎসক পাঠায় না। জীবনঝুঁকি হলে স্থানীয় চিকিৎসা নিন।',
  },
  bookingEmergency: {
    en: 'Emergency booking is a request for urgent care — not a guarantee of immediate response or arrival.',
    bn: 'জরুরি বুকিং তাত্ক্ষণিক সেবার নিশ্চয়তা দেয় না — এটি জরুরি সেবার অনুরোধ।',
  },
  discoveryEmergency: {
    en: 'Doctors shown as accepting emergency visits may not be available immediately. Your request is reviewed when possible.',
    bn: 'তালিকাভুক্ত চিকিৎসক জরুরি নিতে পারেন, এখনই খালি থাকবেন এমন নয়। অনুরোধ সম্ভব হলে পর্যালোচনা হয়।',
  },
  requestPending: {
    en: 'Your request is waiting for assignment. Wait times are not guaranteed.',
    bn: 'অনুরোধ অপেক্ষায়। সময় নিশ্চিত নয়।',
  },
  bookingOnline: {
    en: 'Online consultation is not for life-threatening emergencies. Seek in-person care when critical.',
    bn: 'অনলাইন পরামর্শ জীবনঝুঁকির জন্য উপযুক্ত নয়। গুরুতর হলে সশরীরে চিকিৎসা নিন।',
  },
  phoneDial: {
    en: 'This number is configured by Prani Doctor for assistance — confirm it is appropriate for your emergency.',
    bn: 'এটি প্রাণী ডাক্তারের দেওয়া নম্বর — জরুরি ক্ষেত্রে উপযুক্ত কিনা যাচাই করুন।',
  },
};

export const DEFAULT_EMERGENCY_LIMITATION_CONFIG: EmergencyLimitationConfig = {
  contentVersion: '2026-05-30.1',
  enforceAcceptance: true,
  banner: DEFAULT_EMERGENCY_LIMITATION_BANNER,
  urgent: DEFAULT_EMERGENCY_LIMITATION_URGENT,
  full: DEFAULT_EMERGENCY_LIMITATION_FULL,
  contextual: {
    instantCare: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.instantCare },
    aiEmergency: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.aiEmergency },
    bookingEmergency: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.bookingEmergency },
    discoveryEmergency: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.discoveryEmergency },
    requestPending: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.requestPending },
    bookingOnline: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.bookingOnline },
    phoneDial: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.phoneDial },
  },
};

function parseLocaleText(
  raw: unknown,
  fallback: EmergencyLimitationLocaleText,
): EmergencyLimitationLocaleText {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const o = raw as Record<string, unknown>;
  return {
    en: typeof o.en === 'string' && o.en.trim() ? o.en.trim() : fallback.en,
    bn: typeof o.bn === 'string' && o.bn.trim() ? o.bn.trim() : fallback.bn,
  };
}

export function parseEmergencyLimitationConfigJson(j: unknown): EmergencyLimitationConfig {
  if (j === null || typeof j !== 'object' || Array.isArray(j)) {
    return {
      ...DEFAULT_EMERGENCY_LIMITATION_CONFIG,
      banner: { ...DEFAULT_EMERGENCY_LIMITATION_BANNER },
      urgent: { ...DEFAULT_EMERGENCY_LIMITATION_URGENT },
      full: { ...DEFAULT_EMERGENCY_LIMITATION_FULL },
      contextual: {
        instantCare: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.instantCare },
        aiEmergency: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.aiEmergency },
        bookingEmergency: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.bookingEmergency },
        discoveryEmergency: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.discoveryEmergency },
        requestPending: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.requestPending },
        bookingOnline: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.bookingOnline },
        phoneDial: { ...DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.phoneDial },
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
        : DEFAULT_EMERGENCY_LIMITATION_CONFIG.contentVersion,
    enforceAcceptance:
      typeof o.enforceAcceptance === 'boolean'
        ? o.enforceAcceptance
        : DEFAULT_EMERGENCY_LIMITATION_CONFIG.enforceAcceptance,
    banner: parseLocaleText(o.banner, DEFAULT_EMERGENCY_LIMITATION_BANNER),
    urgent: parseLocaleText(o.urgent, DEFAULT_EMERGENCY_LIMITATION_URGENT),
    full: parseLocaleText(o.full, DEFAULT_EMERGENCY_LIMITATION_FULL),
    contextual: {
      instantCare: parseLocaleText(
        contextualRaw.instantCare,
        DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.instantCare,
      ),
      aiEmergency: parseLocaleText(
        contextualRaw.aiEmergency,
        DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.aiEmergency,
      ),
      bookingEmergency: parseLocaleText(
        contextualRaw.bookingEmergency,
        DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.bookingEmergency,
      ),
      discoveryEmergency: parseLocaleText(
        contextualRaw.discoveryEmergency,
        DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.discoveryEmergency,
      ),
      requestPending: parseLocaleText(
        contextualRaw.requestPending,
        DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.requestPending,
      ),
      bookingOnline: parseLocaleText(
        contextualRaw.bookingOnline,
        DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.bookingOnline,
      ),
      phoneDial: parseLocaleText(
        contextualRaw.phoneDial,
        DEFAULT_EMERGENCY_LIMITATION_CONTEXTUAL.phoneDial,
      ),
    },
  };
}

export function emergencyLimitationConfigToSettingJson(
  config: EmergencyLimitationConfig,
): Record<string, unknown> {
  return {
    contentVersion: config.contentVersion,
    enforceAcceptance: config.enforceAcceptance,
    banner: config.banner,
    urgent: config.urgent,
    full: config.full,
    contextual: config.contextual,
  };
}

export type EmergencyLimitationLocale = 'en' | 'bn';

export function pickEmergencyLimitationLocaleText(
  text: EmergencyLimitationLocaleText,
  locale: EmergencyLimitationLocale,
): string {
  return locale === 'bn' ? text.bn : text.en;
}
