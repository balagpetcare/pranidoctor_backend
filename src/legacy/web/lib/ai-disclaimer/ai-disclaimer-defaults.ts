/** Canonical AI disclaimer tiers — docs/compliance/ai/ai-disclaimer-plan.md */

export const AI_DISCLAIMER_SETTING_KEY = 'mobile.ai.disclaimer.config';

export type AiDisclaimerLocaleText = {
  en: string;
  bn: string;
};

export type AiDisclaimerFeatureKey = 'chat' | 'recommendations' | 'advisory';

export type AiDisclaimerConfig = {
  /** Display metadata — acceptance version is legal.aiConsentVersion */
  contentVersion: string;
  enforceAcceptance: boolean;
  /** T1 — persistent banner */
  banner: AiDisclaimerLocaleText;
  /** T2 — feature-specific contextual */
  contextual: Record<AiDisclaimerFeatureKey, AiDisclaimerLocaleText>;
};

export const DEFAULT_AI_DISCLAIMER_BANNER: AiDisclaimerLocaleText = {
  en: 'Prani Doctor AI provides general livestock guidance. It cannot examine your animal and may be incomplete — not a substitute for a veterinarian.',
  bn: 'প্রাণী ডাক্তার AI সাধারণ পশুপালন নির্দেশনা দেয়। এটি আপনার পশু পরীক্ষা করতে পারে না এবং ত্রুটিপূর্ণ হতে পারে — প্রাণী চিকিৎসকের বিকল্প নয়।',
};

export const DEFAULT_AI_DISCLAIMER_CONTEXTUAL: Record<
  AiDisclaimerFeatureKey,
  AiDisclaimerLocaleText
> = {
  chat: {
    en: 'AI chat is educational only — never a diagnosis or prescription.',
    bn: 'AI চ্যাট শুধুমাত্র শিক্ষামূলক — কখনো নির্ণয় বা ওষুধের নির্দেশ নয়।',
  },
  recommendations: {
    en: 'Automated farm reminders — verify with a veterinarian before medical action.',
    bn: 'স্বয়ংক্রিয় খামার অনুস্মারক — চিকিৎসা সিদ্ধান্তের আগে প্রাণী চিকিৎসকের পরামর্শ নিন।',
  },
  advisory: {
    en: 'Symptom and health guidance is assistive information only — not a medical diagnosis.',
    bn: 'লক্ষণ ও স্বাস্থ্য নির্দেশনা সহায়ক তথ্য মাত্র — চিকিৎসা নির্ণয় নয়।',
  },
};

export const DEFAULT_AI_DISCLAIMER_CONFIG: AiDisclaimerConfig = {
  contentVersion: '2026-05-30.1',
  enforceAcceptance: true,
  banner: DEFAULT_AI_DISCLAIMER_BANNER,
  contextual: DEFAULT_AI_DISCLAIMER_CONTEXTUAL,
};

function parseLocaleText(raw: unknown, fallback: AiDisclaimerLocaleText): AiDisclaimerLocaleText {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const o = raw as Record<string, unknown>;
  return {
    en:
      typeof o.en === 'string' && o.en.trim() ? o.en.trim() : fallback.en,
    bn:
      typeof o.bn === 'string' && o.bn.trim() ? o.bn.trim() : fallback.bn,
  };
}

export function parseAiDisclaimerConfigJson(j: unknown): AiDisclaimerConfig {
  if (j === null || typeof j !== 'object' || Array.isArray(j)) {
    return {
      ...DEFAULT_AI_DISCLAIMER_CONFIG,
      banner: { ...DEFAULT_AI_DISCLAIMER_BANNER },
      contextual: {
        chat: { ...DEFAULT_AI_DISCLAIMER_CONTEXTUAL.chat },
        recommendations: { ...DEFAULT_AI_DISCLAIMER_CONTEXTUAL.recommendations },
        advisory: { ...DEFAULT_AI_DISCLAIMER_CONTEXTUAL.advisory },
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
        : DEFAULT_AI_DISCLAIMER_CONFIG.contentVersion,
    enforceAcceptance:
      typeof o.enforceAcceptance === 'boolean'
        ? o.enforceAcceptance
        : DEFAULT_AI_DISCLAIMER_CONFIG.enforceAcceptance,
    banner: parseLocaleText(o.banner, DEFAULT_AI_DISCLAIMER_BANNER),
    contextual: {
      chat: parseLocaleText(contextualRaw.chat, DEFAULT_AI_DISCLAIMER_CONTEXTUAL.chat),
      recommendations: parseLocaleText(
        contextualRaw.recommendations,
        DEFAULT_AI_DISCLAIMER_CONTEXTUAL.recommendations,
      ),
      advisory: parseLocaleText(contextualRaw.advisory, DEFAULT_AI_DISCLAIMER_CONTEXTUAL.advisory),
    },
  };
}

export function aiDisclaimerConfigToSettingJson(
  config: AiDisclaimerConfig,
): Record<string, unknown> {
  return {
    contentVersion: config.contentVersion,
    enforceAcceptance: config.enforceAcceptance,
    banner: config.banner,
    contextual: config.contextual,
  };
}

export type AiDisclaimerLocale = 'en' | 'bn';

export function pickDisclaimerLocaleText(
  text: AiDisclaimerLocaleText,
  locale: AiDisclaimerLocale,
): string {
  return locale === 'bn' ? text.bn : text.en;
}
