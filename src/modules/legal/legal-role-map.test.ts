import { describe, expect, it } from 'vitest';

import { requiredDocumentKeysForRole } from './legal-role-map.js';
import { LEGAL_DOCUMENT_KEYS } from './document-keys.js';

describe('legal-role-map', () => {
  it('maps customer role to ToS and privacy', () => {
    expect(requiredDocumentKeysForRole('CUSTOMER')).toEqual([
      LEGAL_DOCUMENT_KEYS.TOS_CUSTOMER,
      LEGAL_DOCUMENT_KEYS.PRIVACY_POLICY,
    ]);
  });

  it('maps doctor role to provider agreement', () => {
    expect(requiredDocumentKeysForRole('DOCTOR')).toEqual([
      LEGAL_DOCUMENT_KEYS.TOS_PROVIDER_DOCTOR,
    ]);
  });

  it('maps admin roles to admin AUP', () => {
    expect(requiredDocumentKeysForRole('ADMIN')).toEqual([LEGAL_DOCUMENT_KEYS.TOS_ADMIN]);
    expect(requiredDocumentKeysForRole('SUPER_ADMIN')).toEqual([LEGAL_DOCUMENT_KEYS.TOS_ADMIN]);
  });
});
