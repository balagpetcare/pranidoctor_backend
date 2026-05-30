import type { UserRole } from '@/generated/prisma/client';

import { authRequestContext } from '../../../../modules/auth/auth-audit.service.js';
import {
  getDocumentForRole,
  getLegalStatusForUser,
  getPublishedDocument,
  LegalDocumentNotPublishedError,
  recordLegalAcceptance,
  recordLegalAcceptanceFireAndForget,
} from '../../../../modules/legal/legal-acceptance.service.js';

export async function getPanelLegalStatus(userId: string, role: UserRole, locale?: string | null) {
  return getLegalStatusForUser(userId, role, locale);
}

export async function acceptPanelLegalDocument(input: {
  userId: string;
  role: UserRole;
  documentKey: string;
  version: string;
  locale?: string | null;
  request?: Request;
  appSurface?: string;
  method?: 'EXPLICIT_BUTTON' | 'PROVIDER_ONBOARDING' | 'FORCED_RECONSENT';
}) {
  const published = await getPublishedDocument(
    input.documentKey,
    input.locale?.trim() || 'bn-BD',
  );
  if (!published) {
    throw new LegalDocumentNotPublishedError(input.documentKey, input.version);
  }

  const version =
    input.version === 'UNPUBLISHED' || input.version !== published.version
      ? published.version
      : input.version;

  const ctx = input.request ? authRequestContext(input.request) : {};
  const saved = await recordLegalAcceptance({
    userId: input.userId,
    role: input.role,
    documentKey: input.documentKey,
    version,
    locale: published.locale,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    appSurface: input.appSurface,
    method: input.method ?? 'EXPLICIT_BUTTON',
  });

  if (!saved) {
    throw new LegalDocumentNotPublishedError(input.documentKey, version);
  }

  return getLegalStatusForUser(input.userId, input.role, input.locale);
}

export async function getPanelLegalDocument(
  documentKey: string,
  userId: string,
  role: UserRole,
  locale?: string | null,
) {
  const doc = await getDocumentForRole(documentKey, locale);
  if (!doc) return null;
  const status = await getLegalStatusForUser(userId, role, locale);
  const req = status.requirements.find((r) => r.documentKey === documentKey);
  return {
    document: {
      ...doc,
      accepted: req?.accepted ?? false,
      acceptedAt: req?.acceptedAt ?? null,
    },
  };
}

export function mapLegalSummaryForAuthMe(status: Awaited<ReturnType<typeof getLegalStatusForUser>>) {
  return {
    allAccepted: status.allAccepted,
    pendingDocuments: status.pendingDocuments,
  };
}
