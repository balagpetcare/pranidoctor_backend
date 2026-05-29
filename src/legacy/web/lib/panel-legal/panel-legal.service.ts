import type { UserRole } from '@/generated/prisma/client';

import { authRequestContext } from '../../../modules/auth/auth-audit.service.js';
import {
  getDocumentForRole,
  getLegalStatusForUser,
  recordLegalAcceptanceFireAndForget,
} from '../../../modules/legal/legal-acceptance.service.js';

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
  const ctx = input.request ? authRequestContext(input.request) : {};
  recordLegalAcceptanceFireAndForget({
    userId: input.userId,
    role: input.role,
    documentKey: input.documentKey,
    version: input.version,
    locale: input.locale,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    appSurface: input.appSurface,
    method: input.method ?? 'EXPLICIT_BUTTON',
  });
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
