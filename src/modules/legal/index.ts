export { LEGAL_DOCUMENT_KEYS, LEGAL_CONSENT_TO_DOCUMENT_KEY } from './document-keys.js';
export {
  getDocumentForRole,
  getLegalStatusForUser,
  getPublishedDocument,
  hasAcceptedCurrentDocument,
  recordLegalAcceptance,
  recordLegalAcceptanceFireAndForget,
  upsertLegalDocument,
  type LegalDocumentDto,
  type LegalRequirementDto,
  type LegalStatusDto,
} from './legal-acceptance.service.js';
export {
  appSurfaceForRole,
  hashLegalContent,
  isLegalEnforcementEnabled,
  requiredDocumentKeysForRole,
} from './legal-role-map.js';
export { seedLegalDocuments, LEGAL_DOCUMENT_CURRENT_VERSION } from './legal-document-seed.js';
