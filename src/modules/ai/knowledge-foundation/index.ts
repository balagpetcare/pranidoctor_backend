export {
  KNOWLEDGE_FOUNDATION_SCHEMA_VERSION,
  VK_AUDIT_EVENTS,
  buildSearchText,
  contentTypeToDomain,
  isVersionEditable,
  requiresVetApproval,
  type KnowledgeSourceDto,
  type KnowledgeEntityDto,
  type KnowledgeVersionDto,
  type KnowledgeCitationDto,
  type KnowledgeReviewDto,
  type KnowledgeApprovalDto,
  type KnowledgeAuditEventDto,
  type VkAuditEventType,
  type FoundationActor,
} from './knowledge-foundation.types.js';
export {
  getKnowledgeFoundationService,
  resetKnowledgeFoundationServiceForTests,
  KnowledgeFoundationService,
} from './knowledge-foundation.service.js';
export {
  getKnowledgeFoundationController,
  KnowledgeFoundationController,
} from './knowledge-foundation.controller.js';
export { configureKnowledgeFoundationAdminRoutes } from './knowledge-foundation.routes.js';
export {
  knowledgeFoundationCan,
  assertKnowledgeFoundationCan,
  type KnowledgeFoundationCapability,
} from './permissions/knowledge-foundation.permissions.js';
export { getKnowledgeAuditService, resetKnowledgeAuditServiceForTests } from './audit/knowledge-audit.service.js';
export {
  computeVersionSignOffHash,
  defaultInlineCitationKey,
  evaluateCitationTrustRules,
} from './knowledge-foundation.util.js';

import { resetKnowledgeAuditRepositoryForTests } from './audit/knowledge-audit.repository.js';
import { resetKnowledgeApprovalRepositoryForTests } from './repositories/knowledge-approval.repository.js';
import { resetKnowledgeCitationRepositoryForTests } from './repositories/knowledge-citation.repository.js';
import { resetKnowledgeEntityRepositoryForTests } from './repositories/knowledge-entity.repository.js';
import { resetKnowledgeReviewRepositoryForTests } from './repositories/knowledge-review.repository.js';
import { resetKnowledgeSourceRepositoryForTests } from './repositories/knowledge-source.repository.js';
import { resetKnowledgeVersionRepositoryForTests } from './repositories/knowledge-version.repository.js';
import { resetKnowledgeAuditServiceForTests } from './audit/knowledge-audit.service.js';
import { resetKnowledgeFoundationServiceForTests } from './knowledge-foundation.service.js';

export function resetAllKnowledgeFoundationForTests(): void {
  resetKnowledgeFoundationServiceForTests();
  resetKnowledgeAuditServiceForTests();
  resetKnowledgeEntityRepositoryForTests();
  resetKnowledgeVersionRepositoryForTests();
  resetKnowledgeCitationRepositoryForTests();
  resetKnowledgeReviewRepositoryForTests();
  resetKnowledgeApprovalRepositoryForTests();
  resetKnowledgeSourceRepositoryForTests();
  resetKnowledgeAuditRepositoryForTests();
}
