import { resolveFeatureDisclaimerText } from '../../../legacy/web/lib/ai-disclaimer/ai-disclaimer.service.js';
import type { AiDisclaimerFeatureKey, AiDisclaimerLocale } from '../../../legacy/web/lib/ai-disclaimer/ai-disclaimer-defaults.js';
import { AI_DISCLAIMER } from '../../ai-veterinary-core/ai-veterinary-core.types.js';

export async function resolveAiResponseDisclaimer(
  feature: AiDisclaimerFeatureKey,
  locale: AiDisclaimerLocale,
): Promise<string> {
  try {
    return await resolveFeatureDisclaimerText(feature, locale);
  } catch {
    return AI_DISCLAIMER[locale];
  }
}
