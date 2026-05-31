export {
  KNOWLEDGE_CHUNKING_SCHEMA_VERSION,
  CHUNK_METADATA_SCHEMA_VERSION,
  CONFIDENCE_FORMULA_VERSION,
  CHUNK_POLICY_IDS,
  type ChunkPolicyId,
  type ChunkMetadataEnvelopeV1,
  type ProcessVersionInput,
  type ProcessVersionResult,
  type StagedChunkDraft,
} from './knowledge-chunking.types.js';
export {
  getChunkEngineService,
  resetChunkEngineForTests,
  ChunkEngineService,
} from './chunking/chunk-engine.service.js';
export {
  getCitationEngineService,
  resetCitationEngineForTests,
  CitationEngineService,
} from './citation/citation-engine.service.js';
export {
  getEvidenceAssignmentService,
  resetEvidenceAssignmentForTests,
  EvidenceAssignmentService,
} from './evidence/evidence-assignment.service.js';
export {
  getConfidenceAssignmentService,
  resetConfidenceAssignmentForTests,
  ConfidenceAssignmentService,
} from './confidence/confidence-assignment.service.js';
export {
  getChunkMetadataEnricher,
  resetChunkMetadataEnricherForTests,
  ChunkMetadataEnricher,
} from './metadata/chunk-metadata.enricher.js';
export {
  resolveChunkPolicyForDomain,
  isChunkPolicyId,
} from './policies/chunk-policy.registry.js';
export {
  getKnowledgeChunkingOrchestratorService,
  resetKnowledgeChunkingOrchestratorForTests,
  KnowledgeChunkingOrchestratorService,
} from './knowledge-chunking-orchestrator.service.js';

import { resetChunkEngineForTests } from './chunking/chunk-engine.service.js';
import { resetCitationEngineForTests } from './citation/citation-engine.service.js';
import { resetConfidenceAssignmentForTests } from './confidence/confidence-assignment.service.js';
import { resetEvidenceAssignmentForTests } from './evidence/evidence-assignment.service.js';
import { resetKnowledgeChunkingOrchestratorForTests } from './knowledge-chunking-orchestrator.service.js';
import { resetChunkMetadataEnricherForTests } from './metadata/chunk-metadata.enricher.js';
import { resetKnowledgeChunkRepositoryForTests } from './repositories/knowledge-chunk.repository.js';
import { resetKnowledgeConfidenceRepositoryForTests } from './repositories/knowledge-confidence.repository.js';
import { resetKnowledgeEvidenceRepositoryForTests } from './repositories/knowledge-evidence.repository.js';

export function resetAllKnowledgeChunkingForTests(): void {
  resetKnowledgeChunkingOrchestratorForTests();
  resetChunkEngineForTests();
  resetCitationEngineForTests();
  resetEvidenceAssignmentForTests();
  resetConfidenceAssignmentForTests();
  resetChunkMetadataEnricherForTests();
  resetKnowledgeChunkRepositoryForTests();
  resetKnowledgeEvidenceRepositoryForTests();
  resetKnowledgeConfidenceRepositoryForTests();
}
