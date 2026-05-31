export type {
  KnowledgeContextPack,
  RetrievalRequest,
  RetrievalProfile,
  RetrievedChunk,
  ConfidenceRoutingDecision,
  MedicalRiskTier,
  EvidenceSummary,
} from './knowledge-retrieval.types.js';
export {
  KnowledgeRetrievalService,
  getKnowledgeRetrievalService,
  resetKnowledgeRetrievalServiceForTests,
} from './knowledge-retrieval.service.js';
export {
  KnowledgeEmbeddingPipelineService,
  getKnowledgeEmbeddingPipelineService,
  resetKnowledgeEmbeddingPipelineForTests,
} from './embedding/embedding-pipeline.service.js';
export {
  KnowledgeEmbeddingService,
  getKnowledgeEmbeddingService,
  resetKnowledgeEmbeddingServiceForTests,
} from './embedding/knowledge-embedding.service.js';
export {
  KnowledgeEmbeddingQueueService,
  getKnowledgeEmbeddingQueueService,
  resetKnowledgeEmbeddingQueueForTests,
} from './embedding/embedding-queue.service.js';
export {
  EmbeddingRouterAdapter,
  getEmbeddingRouterAdapter,
  resetEmbeddingRouterAdapterForTests,
} from './embedding/embedding-router.adapter.js';
export { fuseHybridCandidates, getHybridFusionService } from './search/hybrid-fusion.service.js';
export {
  decideConfidenceRouting,
  buildKnowledgeContextPack,
  extractStructuredFacts,
} from './routing/confidence-router.service.js';
export { buildCitationBlock, buildGroundingInstruction } from './packs/citation-builder.js';
export { buildEvidenceBlock, buildEvidenceSummary } from './packs/evidence-builder.js';
export { buildConfidenceBlock, buildConfidenceSummary } from './packs/confidence-builder.js';
export { buildEnrichedPromptContext } from './grounding/grounding-engine.js';
export {
  detectMedicalIntent,
  evaluateMedicalSafety,
  assessMedicalRiskTier,
} from './grounding/medical-safety.service.js';
export { applyLowConfidencePolicy } from './grounding/low-confidence.handler.js';
export { getRerankerService, rerankCandidates } from './ranking/reranker.service.js';
export {
  getCrossEncoderRerankerService,
  applyCrossEncoderRerank,
  scoreCrossEncoderPair,
} from './ranking/cross-encoder-reranker.service.js';
export { resolveRetrievalProfile, RETRIEVAL_PROFILES } from './profiles/retrieval-profile.registry.js';
export {
  resolveCalibratedRetrievalProfile,
  applyMedicalConfidenceCalibration,
  MEDICAL_CONFIDENCE_CALIBRATION,
} from './calibration/medical-confidence.calibration.js';
export { normalizeQueryForRetrieval, normalizeRetrievalQueryText } from './query/query-normalizer.service.js';
export { expandColloquialTerms, COLLOQUIAL_BN_MAP } from './query/colloquial-map.js';
export { buildRetrievalMetadataJson, hashRetrievalQuery } from './telemetry/retrieval-metadata.builder.js';
export type { RetrievalMetadataJson } from './telemetry/retrieval-metadata.builder.js';
export {
  getPostLlmValidatorService,
  validateLlmOutput,
} from './validation/post-llm-validator.service.js';
export type { PostLlmValidationResult } from './validation/post-llm-validator.service.js';
export { getVreConfig, resolveVreConfig, setVreConfigForTests } from './config/vre-config.js';
export { evaluateGoldenQuery, computePrecisionAt4, summarizeGoldenEval } from './eval/golden-set.eval.js';
export type { GoldenQuery, GoldenEvalResult } from './eval/golden-set.eval.js';
export {
  evaluateGseRecord,
  summarizeGseEval,
  compositeScoresFromSummary,
  getGseEvaluatorService,
  resetGseEvaluatorForTests,
} from './eval/gse-evaluator.service.js';
export type { GseEvaluateParams } from './eval/gse-evaluator.service.js';
export {
  runAiDoctorGoldenEval,
  summarizeAiDoctorEval,
} from './eval/ai-doctor-eval.runner.js';
export type { AiDoctorEvalRow, AiDoctorEvalOptions } from './eval/ai-doctor-eval.runner.js';
export type {
  GoldenEvalRecord,
  GseEvalResult,
  GseEvalSummary,
  GseCompositeScores,
  GseDimension,
  ExpectedAnswerSpec,
  ExpectedCitationSpec,
  ExpectedEscalationSpec,
  ExpectedConfidenceSpec,
} from './eval/golden-set.types.js';
export { normalizeGoldenRecord, GSE_DIMENSION_WEIGHTS } from './eval/golden-set.types.js';
export { isPgvectorColumnAvailable, upsertEmbeddingVector } from './search/pgvector.util.js';
export { searchPgvectorAnn } from './search/pgvector-ann.service.js';
export { cosineSimilarity } from './embedding/vector-math.util.js';
export {
  runKnowledgeEmbeddingRefreshJob,
  runEmbeddingVersionDriftJob,
  runPgvectorBackfillJob,
  runFullCorpusEmbedJob,
} from './embedding/embedding-refresh.job.js';
export {
  bootstrapKnowledgeEmbeddingWorkers,
  processKnowledgeEmbeddingJob,
} from './embedding/knowledge-embedding-worker.bootstrap.js';
