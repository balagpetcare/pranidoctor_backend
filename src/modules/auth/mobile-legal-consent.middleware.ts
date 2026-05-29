import type { Request, Response, NextFunction } from 'express';

import { ForbiddenError } from '../../shared/errors/http.errors.js';
import { loadAiDisclaimerConfig } from '../../legacy/web/lib/ai-disclaimer/ai-disclaimer-config.js';
import { getMobileLegalConsentStatusForUser } from '../../legacy/web/lib/mobile-settings/mobile-legal-consent.js';

/** Requires current privacy policy acceptance (Express /api/ai routes). */
export async function requireMobilePrivacyConsent(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }
    const status = await getMobileLegalConsentStatusForUser(userId);
    if (!status.privacyAccepted) {
      throw new ForbiddenError(
        'LEGAL_CONSENT_REQUIRED',
        'Privacy policy acceptance required',
        {
          missing: ['privacy'],
          privacyVersion: status.privacyVersion,
          termsVersion: status.termsVersion,
          aiConsentVersion: status.aiConsentVersion,
        },
      );
    }
    next();
  } catch (error) {
    next(error);
  }
}

/** Requires AI processing consent in addition to privacy when enforcement is enabled. */
export async function requireMobileAiConsent(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }
    const [status, disclaimer] = await Promise.all([
      getMobileLegalConsentStatusForUser(userId),
      loadAiDisclaimerConfig(),
    ]);
    const missing: string[] = [];
    if (!status.privacyAccepted) missing.push('privacy');
    if (disclaimer.enforceAcceptance && !status.aiConsentAccepted) missing.push('ai');
    if (missing.length > 0) {
      throw new ForbiddenError(
        'LEGAL_CONSENT_REQUIRED',
        'Legal consent required for AI features',
        {
          missing,
          privacyVersion: status.privacyVersion,
          termsVersion: status.termsVersion,
          aiConsentVersion: status.aiConsentVersion,
          enforceAcceptance: disclaimer.enforceAcceptance,
        },
      );
    }
    next();
  } catch (error) {
    next(error);
  }
}
