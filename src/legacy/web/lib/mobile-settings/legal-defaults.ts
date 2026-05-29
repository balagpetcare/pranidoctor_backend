/** In-app legal summaries and default version strings (canonical policy: docs/compliance/legal/PRIVACY_POLICY.md). */

export const LEGAL_SETTING_KEY = 'mobile.legal.config';

export const DEFAULT_PRIVACY_VERSION = '2026-06-01';
export const DEFAULT_TERMS_VERSION = '2026-06-01';
export const DEFAULT_AI_CONSENT_VERSION = '2026-06-01';
export const DEFAULT_VET_DISCLAIMER_VERSION = '2026-05-30.1';
export const DEFAULT_EMERGENCY_LIMITATION_VERSION = '2026-05-30.1';

export type LegalConfig = {
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  privacyVersion: string;
  termsVersion: string;
  aiConsentVersion: string;
  vetDisclaimerVersion: string;
  emergencyLimitationVersion: string;
  privacyTitle: string;
  termsTitle: string;
  aiConsentTitle: string;
  vetDisclaimerTitle: string;
  emergencyLimitationTitle: string;
  privacyContent: string;
  termsContent: string;
  aiConsentContent: string;
  enforcePrivacyConsent: boolean;
  /** When true, Flutter / client should gate core features until ToS + privacy accepted. */
  legalGateEnabled: boolean;
};

export const DEFAULT_PRIVACY_SUMMARY = `Prani Doctor respects your privacy. We collect account, location hierarchy, animal and farm records, device identifiers, and service history to provide veterinary and farm management services.

We share data with assigned doctors and technicians only as needed. We do not sell personal data. AI features send context to LLM providers when you use them — see AI consent.

Contact support@pranidoctor.com to exercise data rights. Full policy: published URL below.`;

export const DEFAULT_TERMS_SUMMARY = `By using Prani Doctor you agree to use the app for lawful farm management and veterinary service purposes. AI guidance is informational only and not a substitute for professional veterinary care.

You are responsible for accurate information you provide and for keeping your account credentials secure.`;

export const DEFAULT_AI_CONSENT_SUMMARY = `Prani Doctor AI features (chat, symptom check, farm briefing) may send your messages and limited animal/farm context to third-party AI providers (OpenAI, Anthropic) for inference only.

AI does not diagnose or prescribe. Always consult a licensed veterinarian for treatment decisions. You can decline AI features and still use non-AI parts of the app.`;

export const DEFAULT_LEGAL: LegalConfig = {
  privacyPolicyUrl:
    process.env.MOBILE_PRIVACY_POLICY_URL?.trim() || 'https://pranidoctor.com/privacy',
  termsOfServiceUrl:
    process.env.MOBILE_TERMS_OF_SERVICE_URL?.trim() || 'https://pranidoctor.com/terms',
  privacyVersion: DEFAULT_PRIVACY_VERSION,
  termsVersion: DEFAULT_TERMS_VERSION,
  aiConsentVersion: DEFAULT_AI_CONSENT_VERSION,
  vetDisclaimerVersion: DEFAULT_VET_DISCLAIMER_VERSION,
  emergencyLimitationVersion: DEFAULT_EMERGENCY_LIMITATION_VERSION,
  privacyTitle: 'Privacy Policy',
  termsTitle: 'Terms of Service',
  aiConsentTitle: 'AI Processing Consent',
  vetDisclaimerTitle: 'Veterinary Advice Disclaimer',
  emergencyLimitationTitle: 'Emergency Service Limitation Notice',
  privacyContent: DEFAULT_PRIVACY_SUMMARY,
  termsContent: DEFAULT_TERMS_SUMMARY,
  aiConsentContent: DEFAULT_AI_CONSENT_SUMMARY,
  enforcePrivacyConsent: process.env.MOBILE_ENFORCE_PRIVACY_CONSENT?.trim().toLowerCase() === 'true',
  legalGateEnabled: process.env.MOBILE_LEGAL_GATE_ENABLED?.trim().toLowerCase() !== 'false',
};

export function parseLegalConfigJson(j: unknown): LegalConfig {
  if (j === null || typeof j !== 'object' || Array.isArray(j)) {
    return { ...DEFAULT_LEGAL };
  }
  const o = j as Record<string, unknown>;
  return {
    privacyPolicyUrl:
      typeof o.privacyPolicyUrl === 'string' && o.privacyPolicyUrl.trim()
        ? o.privacyPolicyUrl.trim()
        : DEFAULT_LEGAL.privacyPolicyUrl,
    termsOfServiceUrl:
      typeof o.termsOfServiceUrl === 'string' && o.termsOfServiceUrl.trim()
        ? o.termsOfServiceUrl.trim()
        : DEFAULT_LEGAL.termsOfServiceUrl,
    privacyVersion:
      typeof o.privacyVersion === 'string' && o.privacyVersion.trim()
        ? o.privacyVersion.trim()
        : DEFAULT_LEGAL.privacyVersion,
    termsVersion:
      typeof o.termsVersion === 'string' && o.termsVersion.trim()
        ? o.termsVersion.trim()
        : DEFAULT_LEGAL.termsVersion,
    aiConsentVersion:
      typeof o.aiConsentVersion === 'string' && o.aiConsentVersion.trim()
        ? o.aiConsentVersion.trim()
        : DEFAULT_LEGAL.aiConsentVersion,
    vetDisclaimerVersion:
      typeof o.vetDisclaimerVersion === 'string' && o.vetDisclaimerVersion.trim()
        ? o.vetDisclaimerVersion.trim()
        : DEFAULT_LEGAL.vetDisclaimerVersion,
    emergencyLimitationVersion:
      typeof o.emergencyLimitationVersion === 'string' && o.emergencyLimitationVersion.trim()
        ? o.emergencyLimitationVersion.trim()
        : DEFAULT_LEGAL.emergencyLimitationVersion,
    privacyTitle:
      typeof o.privacyTitle === 'string' && o.privacyTitle.trim()
        ? o.privacyTitle.trim()
        : DEFAULT_LEGAL.privacyTitle,
    termsTitle:
      typeof o.termsTitle === 'string' && o.termsTitle.trim()
        ? o.termsTitle.trim()
        : DEFAULT_LEGAL.termsTitle,
    aiConsentTitle:
      typeof o.aiConsentTitle === 'string' && o.aiConsentTitle.trim()
        ? o.aiConsentTitle.trim()
        : DEFAULT_LEGAL.aiConsentTitle,
    vetDisclaimerTitle:
      typeof o.vetDisclaimerTitle === 'string' && o.vetDisclaimerTitle.trim()
        ? o.vetDisclaimerTitle.trim()
        : DEFAULT_LEGAL.vetDisclaimerTitle,
    emergencyLimitationTitle:
      typeof o.emergencyLimitationTitle === 'string' && o.emergencyLimitationTitle.trim()
        ? o.emergencyLimitationTitle.trim()
        : DEFAULT_LEGAL.emergencyLimitationTitle,
    privacyContent:
      typeof o.privacyContent === 'string' && o.privacyContent.trim()
        ? o.privacyContent.trim()
        : DEFAULT_LEGAL.privacyContent,
    termsContent:
      typeof o.termsContent === 'string' && o.termsContent.trim()
        ? o.termsContent.trim()
        : DEFAULT_LEGAL.termsContent,
    aiConsentContent:
      typeof o.aiConsentContent === 'string' && o.aiConsentContent.trim()
        ? o.aiConsentContent.trim()
        : DEFAULT_LEGAL.aiConsentContent,
    enforcePrivacyConsent:
      typeof o.enforcePrivacyConsent === 'boolean'
        ? o.enforcePrivacyConsent
        : DEFAULT_LEGAL.enforcePrivacyConsent,
    legalGateEnabled:
      typeof o.legalGateEnabled === 'boolean' ? o.legalGateEnabled : DEFAULT_LEGAL.legalGateEnabled,
  };
}

export function legalConfigToSettingJson(config: LegalConfig): Record<string, unknown> {
  return {
    privacyPolicyUrl: config.privacyPolicyUrl,
    termsOfServiceUrl: config.termsOfServiceUrl,
    privacyVersion: config.privacyVersion,
    termsVersion: config.termsVersion,
    aiConsentVersion: config.aiConsentVersion,
    vetDisclaimerVersion: config.vetDisclaimerVersion,
    emergencyLimitationVersion: config.emergencyLimitationVersion,
    privacyTitle: config.privacyTitle,
    termsTitle: config.termsTitle,
    aiConsentTitle: config.aiConsentTitle,
    vetDisclaimerTitle: config.vetDisclaimerTitle,
    emergencyLimitationTitle: config.emergencyLimitationTitle,
    privacyContent: config.privacyContent,
    termsContent: config.termsContent,
    aiConsentContent: config.aiConsentContent,
    enforcePrivacyConsent: config.enforcePrivacyConsent,
    legalGateEnabled: config.legalGateEnabled,
  };
}
