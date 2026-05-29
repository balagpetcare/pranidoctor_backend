import { createHash } from 'node:crypto';

import type { UserRole } from '@/generated/prisma/client';

import { LEGAL_DOCUMENT_KEYS, type LegalDocumentKey } from './document-keys.js';

export function hashLegalContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/** Required published documents per platform role. */
export function requiredDocumentKeysForRole(role: UserRole): LegalDocumentKey[] {
  switch (role) {
    case 'CUSTOMER':
      return [LEGAL_DOCUMENT_KEYS.TOS_CUSTOMER, LEGAL_DOCUMENT_KEYS.PRIVACY_POLICY];
    case 'DOCTOR':
      return [LEGAL_DOCUMENT_KEYS.TOS_PROVIDER_DOCTOR];
    case 'AI_TECHNICIAN':
      return [LEGAL_DOCUMENT_KEYS.TOS_PROVIDER_TECHNICIAN];
    case 'ADMIN':
    case 'SUPER_ADMIN':
    case 'SUPPORT':
      return [LEGAL_DOCUMENT_KEYS.TOS_ADMIN];
    default:
      return [];
  }
}

export function appSurfaceForRole(role: UserRole): string {
  switch (role) {
    case 'CUSTOMER':
      return 'flutter_customer';
    case 'DOCTOR':
      return 'doctor_panel';
    case 'AI_TECHNICIAN':
      return 'technician_panel';
    case 'ADMIN':
    case 'SUPER_ADMIN':
    case 'SUPPORT':
      return 'admin_web';
    default:
      return 'unknown';
  }
}

export function isLegalEnforcementEnabled(): boolean {
  return process.env.LEGAL_ENFORCEMENT_ENABLED?.trim().toLowerCase() === 'true';
}
