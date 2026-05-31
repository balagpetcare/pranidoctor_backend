export {
  KNOWLEDGE_IMPORT_PIPELINE_VERSION,
  KIP_AUDIT_EVENTS,
  type SourceFamilyKey,
  type RawExtract,
  type NormalizedEntityDraft,
  type ImportPipelineStats,
  type StartImportInput,
} from './knowledge-import.types.js';
export {
  getKnowledgeImportRegistryService,
  resetKnowledgeImportRegistryForTests,
  KnowledgeImportRegistryService,
} from './registry/knowledge-import-registry.service.js';
export { SOURCE_FAMILY_PROFILES, resolveProfileForSourceClass } from './registry/source-family.profiles.js';
export {
  getKnowledgeImportOrchestratorService,
  resetKnowledgeImportOrchestratorForTests,
  KnowledgeImportOrchestratorService,
} from './pipeline/knowledge-import-orchestrator.service.js';
export {
  getKnowledgeImportQueueService,
  resetKnowledgeImportQueueForTests,
} from './queues/knowledge-import-queue.service.js';
export {
  getValidationPipelineService,
  resetValidationPipelineForTests,
} from './validation/validation-pipeline.service.js';
export {
  getNormalizationEngine,
  resetNormalizationEngineForTests,
} from './normalization/normalization.engine.js';
export {
  getDuplicateDetectionService,
  resetDuplicateDetectionForTests,
} from './deduplication/duplicate-detection.service.js';
export {
  getVersionEngineService,
  resetVersionEngineForTests,
} from './versioning/version-engine.service.js';
export {
  getApprovalRoutingService,
  resetApprovalRoutingForTests,
} from './routing/approval-routing.service.js';
export {
  getKnowledgeImportController,
  knowledgeImportAdminGuard,
} from './knowledge-import.controller.js';
export { configureKnowledgeImportAdminRoutes } from './knowledge-import.routes.js';

import { resetKnowledgeImportAuditForTests } from './audit/knowledge-import-audit.service.js';
import { resetKnowledgeImportAuditRepositoryForTests } from './audit/knowledge-import-audit.repository.js';
import { resetApprovalRoutingForTests } from './routing/approval-routing.service.js';
import { resetChangeDetectionForTests } from './change-detection/change-detection.service.js';
import { resetDuplicateDetectionForTests } from './deduplication/duplicate-detection.service.js';
import { resetImportJobRepositoryForTests } from './repositories/import-job.repository.js';
import { resetKnowledgeImportOrchestratorForTests } from './pipeline/knowledge-import-orchestrator.service.js';
import { resetKnowledgeImportQueueForTests } from './queues/knowledge-import-queue.service.js';
import { resetKnowledgeImportRegistryForTests } from './registry/knowledge-import-registry.service.js';
import { resetNormalizationEngineForTests } from './normalization/normalization.engine.js';
import { resetQuarantineRepositoryForTests } from './repositories/quarantine.repository.js';
import { resetValidationItemRepositoryForTests } from './repositories/validation-item.repository.js';
import { resetValidationPipelineForTests } from './validation/validation-pipeline.service.js';
import { resetVersionEngineForTests } from './versioning/version-engine.service.js';

export function resetAllKnowledgeImportForTests(): void {
  resetKnowledgeImportOrchestratorForTests();
  resetKnowledgeImportRegistryForTests();
  resetKnowledgeImportQueueForTests();
  resetImportJobRepositoryForTests();
  resetValidationItemRepositoryForTests();
  resetQuarantineRepositoryForTests();
  resetValidationPipelineForTests();
  resetNormalizationEngineForTests();
  resetDuplicateDetectionForTests();
  resetChangeDetectionForTests();
  resetVersionEngineForTests();
  resetApprovalRoutingForTests();
  resetKnowledgeImportAuditForTests();
  resetKnowledgeImportAuditRepositoryForTests();
}
