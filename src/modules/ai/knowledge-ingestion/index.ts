export {
  getKnowledgeSourceRegistryService,
  resetKnowledgeSourceRegistryForTests,
  KnowledgeSourceRegistryService,
} from './registry/source-registry.service.js';
export {
  getKnowledgeImportPipelineService,
  resetKnowledgeImportPipelineForTests,
  KnowledgeImportPipelineService,
} from './pipeline/import-pipeline.service.js';
export {
  getKnowledgeEditorialWorkflowService,
  resetKnowledgeEditorialWorkflowForTests,
  KnowledgeEditorialWorkflowService,
} from './workflow/editorial-workflow.service.js';
export {
  getKnowledgeVetApprovalWorkflowService,
  resetKnowledgeVetApprovalWorkflowForTests,
  KnowledgeVetApprovalWorkflowService,
} from './workflow/vet-approval-workflow.service.js';
export {
  getKnowledgePublishWorkflowService,
  resetKnowledgePublishWorkflowForTests,
  KnowledgePublishWorkflowService,
} from './workflow/publish-workflow.service.js';
export { buildChunksForEntry, resolveChunkPolicyId } from './chunking/chunk-pipeline.service.js';
export {
  assignProvisionalEvidenceLevel,
  finalizeEvidenceLevel,
  inferClinicalRiskTier,
  evidenceLevelScore,
} from './scoring/evidence-level.engine.js';
export { computeConfidenceScore, meetsRetrievalGate } from './scoring/confidence.engine.js';
export { hasRequiredSourceAttribution, parseSourceAttributions, toCitationSourceContext } from './citation/attribution.util.js';
export {
  buildCitationBlock,
  buildSourceAttribution,
  renderHumanCitation,
  renderInlineRagCitation,
} from './citation/citation.service.js';
export type {
  ImportPipelineInput,
  ImportRowInput,
  CreateKnowledgeSourceInput,
  CreateSourceDocumentInput,
  CreateSourceLicenseInput,
  EditorialReviewInput,
  VetApprovalInput,
  PublishKnowledgeInput,
  SourceAttribution,
  StagedChunk,
} from './knowledge-ingestion.types.js';
export { KNOWLEDGE_PIPELINE_VERSION, PROVISIONAL_CONFIDENCE_CAP } from './knowledge-ingestion.types.js';

import {
  resetKnowledgeImportPipelineForTests,
} from './pipeline/import-pipeline.service.js';
import {
  resetKnowledgeSourceRegistryForTests,
} from './registry/source-registry.service.js';
import {
  resetKnowledgeEditorialWorkflowForTests,
} from './workflow/editorial-workflow.service.js';
import {
  resetKnowledgePublishWorkflowForTests,
} from './workflow/publish-workflow.service.js';
import {
  resetKnowledgeVetApprovalWorkflowForTests,
} from './workflow/vet-approval-workflow.service.js';

export function resetAllKnowledgeIngestionServicesForTests(): void {
  resetKnowledgeSourceRegistryForTests();
  resetKnowledgeImportPipelineForTests();
  resetKnowledgeEditorialWorkflowForTests();
  resetKnowledgeVetApprovalWorkflowForTests();
  resetKnowledgePublishWorkflowForTests();
}
