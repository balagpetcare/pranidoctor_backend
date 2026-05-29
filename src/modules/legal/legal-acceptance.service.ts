import { randomUUID } from 'node:crypto';

import type {
  LegalAcceptanceMethod,
  LegalDocument,
  Prisma,
  UserRole,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

import { AuthAuditAction } from '@/generated/prisma/client';
import { recordAuthAuditFireAndForget } from '../auth/auth-audit.service.js';

import { LEGAL_DOCUMENT_KEYS, type LegalDocumentKey } from './document-keys.js';
import {
  appSurfaceForRole,
  hashLegalContent,
  requiredDocumentKeysForRole,
} from './legal-role-map.js';

export type LegalDocumentDto = {
  documentKey: string;
  version: string;
  locale: string;
  title: string;
  summary: string | null;
  content: string;
  contentHash: string;
  publicUrl: string | null;
  requiresReaccept: boolean;
  effectiveAt: string;
};

export type LegalRequirementDto = {
  documentKey: string;
  version: string;
  title: string;
  publicUrl: string | null;
  accepted: boolean;
  acceptedAt: string | null;
};

export type LegalStatusDto = {
  allAccepted: boolean;
  pendingDocuments: LegalRequirementDto[];
  requirements: LegalRequirementDto[];
};

const DEFAULT_LOCALE = 'bn-BD';
const FALLBACK_LOCALE = 'en-US';

export async function getPublishedDocument(
  documentKey: string,
  locale: string,
  tenantId: string | null = null,
): Promise<LegalDocument | null> {
  const locales = locale === FALLBACK_LOCALE ? [locale] : [locale, FALLBACK_LOCALE];
  for (const loc of locales) {
    const doc = await prisma.legalDocument.findFirst({
      where: {
        documentKey,
        locale: loc,
        tenantId,
        publishedAt: { not: null },
      },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }],
    });
    if (doc) return doc;
  }
  return null;
}

export async function getLatestAcceptanceVersion(
  userId: string,
  documentKey: string,
): Promise<string | null> {
  const row = await prisma.legalAcceptanceEvent.findFirst({
    where: { userId, documentKey },
    orderBy: { acceptedAt: 'desc' },
    select: { version: true },
  });
  return row?.version ?? null;
}

export async function hasAcceptedCurrentDocument(
  userId: string,
  documentKey: string,
  locale: string,
): Promise<boolean> {
  const doc = await getPublishedDocument(documentKey, locale);
  if (!doc) return false;
  const accepted = await getLatestAcceptanceVersion(userId, documentKey);
  return accepted === doc.version;
}

function mapDocumentDto(doc: LegalDocument): LegalDocumentDto {
  return {
    documentKey: doc.documentKey,
    version: doc.version,
    locale: doc.locale,
    title: doc.title,
    summary: doc.summary,
    content: doc.contentMarkdown,
    contentHash: doc.contentHash,
    publicUrl: doc.publicUrl,
    requiresReaccept: doc.requiresReaccept,
    effectiveAt: doc.effectiveAt.toISOString(),
  };
}

export async function getDocumentForRole(
  documentKey: string,
  locale?: string | null,
): Promise<LegalDocumentDto | null> {
  const doc = await getPublishedDocument(documentKey, locale?.trim() || DEFAULT_LOCALE);
  return doc ? mapDocumentDto(doc) : null;
}

export async function getLegalStatusForUser(
  userId: string,
  role: UserRole,
  locale?: string | null,
): Promise<LegalStatusDto> {
  const loc = locale?.trim() || DEFAULT_LOCALE;
  const keys = requiredDocumentKeysForRole(role);
  const requirements: LegalRequirementDto[] = [];

  for (const documentKey of keys) {
    const doc = await getPublishedDocument(documentKey, loc);
    if (!doc) {
      // Fail closed — missing published document must block acceptance/compliance.
      requirements.push({
        documentKey,
        version: 'UNPUBLISHED',
        title: documentKey,
        publicUrl: null,
        accepted: false,
        acceptedAt: null,
      });
      continue;
    }

    const latest = await prisma.legalAcceptanceEvent.findFirst({
      where: { userId, documentKey },
      orderBy: { acceptedAt: 'desc' },
      select: { version: true, acceptedAt: true },
    });

    const accepted = latest?.version === doc.version;
    requirements.push({
      documentKey,
      version: doc.version,
      title: doc.title,
      publicUrl: doc.publicUrl,
      accepted,
      acceptedAt: accepted && latest ? latest.acceptedAt.toISOString() : null,
    });
  }

  const pendingDocuments = requirements.filter((r) => !r.accepted);
  return {
    allAccepted: pendingDocuments.length === 0,
    pendingDocuments,
    requirements,
  };
}

export type RecordLegalAcceptanceInput = {
  userId: string;
  role: UserRole;
  documentKey: LegalDocumentKey | string;
  version: string;
  locale?: string | null;
  method?: LegalAcceptanceMethod;
  appSurface?: string;
  appVersion?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  channel?: string;
  metadata?: Prisma.InputJsonValue;
};

/** Append immutable acceptance + auth audit. Never throws. */
export async function recordLegalAcceptance(input: RecordLegalAcceptanceInput): Promise<void> {
  try {
    const locale = input.locale?.trim() || DEFAULT_LOCALE;
    const doc = await prisma.legalDocument.findFirst({
      where: {
        documentKey: input.documentKey,
        version: input.version,
        locale: { in: [locale, FALLBACK_LOCALE] },
      },
      orderBy: { effectiveAt: 'desc' },
    });

    if (!doc) {
      console.warn(
        `[legal] acceptance skipped — document not found key=${input.documentKey} version=${input.version}`,
      );
      return;
    }

    const event = await prisma.legalAcceptanceEvent.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        legalDocumentId: doc.id,
        documentKey: input.documentKey,
        version: input.version,
        locale: doc.locale,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        appSurface: input.appSurface ?? appSurfaceForRole(input.role),
        appVersion: input.appVersion ?? null,
        method: input.method ?? 'EXPLICIT_BUTTON',
        ...(input.metadata !== undefined ? { metadataJson: input.metadata } : {}),
      },
    });

    recordAuthAuditFireAndForget({
      action: AuthAuditAction.LEGAL_ACCEPTED,
      channel: input.channel ?? input.appSurface ?? appSurfaceForRole(input.role),
      userId: input.userId,
      role: input.role,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        legalAcceptanceEventId: event.id,
        documentKey: input.documentKey,
        version: input.version,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[legal] acceptance write failed user=${input.userId} ${msg}`);
  }
}

export function recordLegalAcceptanceFireAndForget(input: RecordLegalAcceptanceInput): void {
  void recordLegalAcceptance(input);
}

export async function upsertLegalDocument(input: {
  documentKey: LegalDocumentKey | string;
  version: string;
  locale: string;
  title: string;
  summary?: string | null;
  contentMarkdown: string;
  publicUrl?: string | null;
  requiresReaccept?: boolean;
  effectiveAt?: Date;
  tenantId?: string | null;
}): Promise<void> {
  const contentHash = hashLegalContent(input.contentMarkdown);
  const effectiveAt = input.effectiveAt ?? new Date();
  const tenantId = input.tenantId ?? null;

  await prisma.legalDocument.upsert({
    where: {
      documentKey_version_locale_tenantId: {
        documentKey: input.documentKey,
        version: input.version,
        locale: input.locale,
        tenantId,
      },
    },
    create: {
      id: randomUUID(),
      documentKey: input.documentKey,
      version: input.version,
      locale: input.locale,
      title: input.title,
      summary: input.summary ?? null,
      contentMarkdown: input.contentMarkdown,
      contentHash,
      publicUrl: input.publicUrl ?? null,
      effectiveAt,
      requiresReaccept: input.requiresReaccept ?? false,
      publishedAt: new Date(),
      tenantId,
    },
    update: {
      title: input.title,
      summary: input.summary ?? null,
      contentMarkdown: input.contentMarkdown,
      contentHash,
      publicUrl: input.publicUrl ?? null,
      requiresReaccept: input.requiresReaccept ?? false,
      effectiveAt,
      publishedAt: new Date(),
    },
  });
}

export { LEGAL_DOCUMENT_KEYS };
