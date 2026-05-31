export {
  KNOWLEDGE_GOVERNANCE_SCHEMA_VERSION,
  GOVERNANCE_STAGES,
  GOVERNANCE_AUDIT_EVENTS,
  type GovernanceStage,
  type GovernanceAuditEventType,
  type ChangeRequestDto,
  type ChangeRequestChecklistItem,
  type GovernanceConflictDto,
  type GovernanceActor,
} from './knowledge-governance.types.js';
export { KnowledgeGovernanceError } from './knowledge-governance.errors.js';
export {
  resolveGovernanceStage,
  governanceStageLabel,
  requiredReviewStages,
} from './stages/governance-stage.resolver.js';
export {
  requiresVetReviewPath,
  isExpeditedEligible,
  assertVetScope,
} from './policy/vet-path.policy.js';
export {
  resolveExpirationPolicy,
  computeApprovalValidUntil,
  listExpirationPolicies,
} from './policy/expiration-policy.registry.js';
export {
  getKnowledgeGovernanceOrchestratorService,
  resetKnowledgeGovernanceOrchestratorServiceForTests,
  KnowledgeGovernanceOrchestratorService,
} from './knowledge-governance-orchestrator.service.js';
export { getGovernanceAuditService, resetGovernanceAuditServiceForTests } from './audit/governance-audit.service.js';
export { getChangeRequestService, resetChangeRequestServiceForTests } from './change-request/change-request.service.js';
export {
  getConflictResolutionService,
  resetConflictResolutionServiceForTests,
} from './conflict/conflict-resolution.service.js';

import { resetGovernanceAuditServiceForTests } from './audit/governance-audit.service.js';
import { resetChangeRequestServiceForTests } from './change-request/change-request.service.js';
import { resetConflictResolutionServiceForTests } from './conflict/conflict-resolution.service.js';
import { resetChangeRequestRepositoryForTests } from './repositories/change-request.repository.js';
import { resetGovernanceConflictRepositoryForTests } from './repositories/governance-conflict.repository.js';
import { resetKnowledgeGovernanceOrchestratorServiceForTests } from './knowledge-governance-orchestrator.service.js';

export function resetAllKnowledgeGovernanceForTests(): void {
  resetKnowledgeGovernanceOrchestratorServiceForTests();
  resetGovernanceAuditServiceForTests();
  resetChangeRequestServiceForTests();
  resetConflictResolutionServiceForTests();
  resetChangeRequestRepositoryForTests();
  resetGovernanceConflictRepositoryForTests();
}
