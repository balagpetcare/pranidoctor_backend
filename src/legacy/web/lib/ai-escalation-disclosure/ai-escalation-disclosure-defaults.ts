/** Canonical AI escalation disclosure — docs/compliance/ai/ai-escalation-disclosure-plan.md */

export const AI_ESCALATION_DISCLOSURE_SETTING_KEY = 'mobile.ai.escalation.disclosure.config';

export type AiEscalationDisclosureLocaleText = {
  en: string;
  bn: string;
};

export type AiEscalationDisclosureTriggerKey =
  | 'emergency'
  | 'high'
  | 'lowConfidence'
  | 'policyRefusal'
  | 'supportVsVet'
  | 'humanReview'
  | 'escalationRecorded'
  | 'keywordLimitation';

export type AiEscalationDisclosureConfig = {
  contentVersion: string;
  /** E1 — persistent in AI contexts */
  banner: AiEscalationDisclosureLocaleText;
  /** E3 — settings / legal reference */
  full: AiEscalationDisclosureLocaleText;
  /** E2 — trigger-specific contextual */
  contextual: Record<AiEscalationDisclosureTriggerKey, AiEscalationDisclosureLocaleText>;
};

export const DEFAULT_AI_ESCALATION_BANNER: AiEscalationDisclosureLocaleText = {
  en: 'AI urgency flags and escalations do not book a veterinarian. Human clinical services are separate from automated guidance.',
  bn: 'AI-র জরুরি সতর্কতা বা এসকেলেশন চিকিৎসক বুক করে না। স্বয়ংক্রিয় নির্দেশনা ও মানব চিকিৎসা সেবা আলাদা।',
};

export const DEFAULT_AI_ESCALATION_FULL: AiEscalationDisclosureLocaleText = {
  en: `Prani Doctor AI may suggest when to seek a veterinarian based on symptoms you report. These suggestions are not pre-reviewed by a clinician, do not dispatch emergency services, and do not assign a doctor automatically.

Escalation records are reviewed by platform operations for safety — not as a treatment plan. Support tickets help with the app, not emergency veterinary care.

If your animal may die without immediate care, contact a licensed veterinarian or emergency facility now — do not wait for AI or in-app responses.`,
  bn: `প্রাণী ডাক্তার AI আপনার লেখা লক্ষণের ভিত্তিতে কখন চিকিৎসকের পরামর্শ নেওয়া উচিত তা বলতে পারে। এগুলো চিকিৎসক দ্বারা আগে যাচাই হয় না, জরুরি সেবা পাঠায় না, এবং স্বয়ংক্রিয়ভাবে চিকিৎসক নিয়োগ করে না।

এসকেলেশন রেকর্ড নিরাপত্তার জন্য প্ল্যাটফর্ম টিম দেখতে পারে — চিকিৎসা পরিকল্পনা নয়। সাপোর্ট অ্যাপ সহায়তা; জরুরি প্রাণী চিকিৎসা নয়।

জীবনঝুঁকি হলে অবিলম্বে প্রাণী চিকিৎসক বা জরুরি কেন্দ্রে যোগাযোগ করুন — AI বা অ্যাপের জন্য অপেক্ষা করবেন না।`,
};

export const DEFAULT_AI_ESCALATION_CONTEXTUAL: Record<
  AiEscalationDisclosureTriggerKey,
  AiEscalationDisclosureLocaleText
> = {
  emergency: {
    en: 'Possible emergency based on your description — seek immediate in-person veterinary care. The app cannot dispatch emergency services.',
    bn: 'আপনার বর্ণনায় সম্ভাব্য জরুরি অবস্থা — অবিলম্বে স্থানীয় প্রাণী চিকিৎসকের সহায়তা নিন। অ্যাপ জরুরি সেবা পাঠাতে পারে না।',
  },
  high: {
    en: 'Urgent — arrange veterinary care as soon as possible. Booking through the app may take time.',
    bn: 'জরুরি — যত তাড়াতাড়ি সম্ভব চিকিৎসকের পরামর্শ নিন। অ্যাপে বুকিং সময় নিতে পারে।',
  },
  lowConfidence: {
    en: 'AI is uncertain about this answer — a licensed veterinarian should advise on next steps.',
    bn: 'AI এই উত্তরে নিশ্চিত নয় — পরবর্তী পদক্ষেপের জন্য চিকিৎসকের পরামর্শ নিন।',
  },
  policyRefusal: {
    en: 'AI cannot provide diagnoses or prescriptions — use doctor consultation for clinical decisions.',
    bn: 'AI নির্ণয় বা ওষুধ লিখতে পারে না — চিকিৎসা সিদ্ধান্তের জন্য চিকিৎসক পরামর্শ নিন।',
  },
  supportVsVet: {
    en: 'Support helps with the app — they do not provide emergency veterinary treatment.',
    bn: 'সাপোর্ট অ্যাপ সহায়তা দেয়; জরুরি প্রাণী চিকিৎসা প্রদান করে না।',
  },
  humanReview: {
    en: 'AI messages are not pre-approved by a veterinarian. Platform review, if any, is not a diagnosis.',
    bn: 'AI-র উত্তর প্রদর্শনের আগে চিকিৎসক দেখেন না। পর্যালোচনা নির্ণয় নয়।',
  },
  escalationRecorded: {
    en: 'Your case may be reviewed by our team. This does not book a veterinarian.',
    bn: 'আমাদের টিম পর্যালোচনা করতে পারে। এটি চিকিৎসক বুকিং নয়।',
  },
  keywordLimitation: {
    en: 'Urgency detection uses the words you enter and may not catch every emergency.',
    bn: 'জরুরি শনাক্তকরণ আপনার লেখা অনুযায়ী; সব জরুরি অবস্থা ধরা নাও পড়তে পারে।',
  },
};

export const DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG: AiEscalationDisclosureConfig = {
  contentVersion: '2026-05-30.1',
  banner: DEFAULT_AI_ESCALATION_BANNER,
  full: DEFAULT_AI_ESCALATION_FULL,
  contextual: {
    emergency: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL.emergency },
    high: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL.high },
    lowConfidence: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL.lowConfidence },
    policyRefusal: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL.policyRefusal },
    supportVsVet: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL.supportVsVet },
    humanReview: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL.humanReview },
    escalationRecorded: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL.escalationRecorded },
    keywordLimitation: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL.keywordLimitation },
  },
};

function parseLocaleText(
  raw: unknown,
  fallback: AiEscalationDisclosureLocaleText,
): AiEscalationDisclosureLocaleText {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const o = raw as Record<string, unknown>;
  return {
    en: typeof o.en === 'string' && o.en.trim() ? o.en.trim() : fallback.en,
    bn: typeof o.bn === 'string' && o.bn.trim() ? o.bn.trim() : fallback.bn,
  };
}

const TRIGGER_KEYS: AiEscalationDisclosureTriggerKey[] = [
  'emergency',
  'high',
  'lowConfidence',
  'policyRefusal',
  'supportVsVet',
  'humanReview',
  'escalationRecorded',
  'keywordLimitation',
];

export function parseAiEscalationDisclosureConfigJson(j: unknown): AiEscalationDisclosureConfig {
  if (j === null || typeof j !== 'object' || Array.isArray(j)) {
    return {
      ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG,
      contextual: { ...DEFAULT_AI_ESCALATION_CONTEXTUAL },
    };
  }
  const o = j as Record<string, unknown>;
  const contextualRaw =
    o.contextual !== null && typeof o.contextual === 'object' && !Array.isArray(o.contextual)
      ? (o.contextual as Record<string, unknown>)
      : {};

  const contextual = {} as Record<AiEscalationDisclosureTriggerKey, AiEscalationDisclosureLocaleText>;
  for (const key of TRIGGER_KEYS) {
    contextual[key] = parseLocaleText(contextualRaw[key], DEFAULT_AI_ESCALATION_CONTEXTUAL[key]);
  }

  return {
    contentVersion:
      typeof o.contentVersion === 'string' && o.contentVersion.trim()
        ? o.contentVersion.trim()
        : DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG.contentVersion,
    banner: parseLocaleText(o.banner, DEFAULT_AI_ESCALATION_BANNER),
    full: parseLocaleText(o.full, DEFAULT_AI_ESCALATION_FULL),
    contextual,
  };
}

export function aiEscalationDisclosureConfigToSettingJson(
  config: AiEscalationDisclosureConfig,
): Record<string, unknown> {
  return {
    contentVersion: config.contentVersion,
    banner: config.banner,
    full: config.full,
    contextual: config.contextual,
  };
}

export type AiEscalationDisclosureLocale = 'en' | 'bn';

export function pickEscalationLocaleText(
  text: AiEscalationDisclosureLocaleText,
  locale: AiEscalationDisclosureLocale,
): string {
  return locale === 'bn' ? text.bn : text.en;
}
