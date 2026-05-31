export {
  AI_DOCTOR_COMPLETENESS_LLM_THRESHOLD,
  AI_DOCTOR_COMPLETENESS_DEGRADED_THRESHOLD,
  AI_DOCTOR_FAIL_CLOSED_CONFIDENCE,
  AI_DOCTOR_ESCALATION_CONFIDENCE,
  AI_DOCTOR_RETRIEVAL_PROFILE,
  AI_DOCTOR_TASK_TYPE,
  AI_DOCTOR_FEATURE,
} from './ai-doctor.constants.js';

export type {
  AiDoctorCase,
  AiDoctorCaseState,
  AiDoctorLocale,
  AnalyzeCaseResult,
  CaseConfidence,
  CaseRiskAssessment,
  ClarificationQuestion,
  CreateAiDoctorCaseInput,
  GroundedDifferential,
  SubmitIntakeInput,
  SymptomSnapshot,
  UrgencyTier,
} from './ai-doctor.types.js';

export {
  AiDoctorOrchestratorService,
  getAiDoctorOrchestratorService,
  resetAiDoctorOrchestratorForTests,
} from './ai-doctor-orchestrator.service.js';

export {
  AiDoctorSessionEngine,
  getAiDoctorSessionEngine,
  resetAiDoctorSessionEngineForTests,
  loadAiDoctorCase,
  persistAiDoctorCase,
  buildNewCase,
} from './engines/ai-doctor-session.engine.js';

export {
  SymptomIntakeEngine,
  getSymptomIntakeEngine,
  computeSymptomCompleteness,
  buildClarificationPlan,
  meetsLlmCompletenessGate,
} from './engines/symptom-intake.engine.js';

export {
  DifferentialDiagnosisEngine,
  getDifferentialDiagnosisEngine,
  fuseDifferentials,
  allDifferentialsHaveCitations,
} from './engines/differential-diagnosis.engine.js';

export {
  EmergencyDetectionEngine,
  getEmergencyDetectionEngine,
  assessCaseRisk,
  shouldSkipLlmForEmergency,
} from './engines/emergency-detection.engine.js';

export {
  ConfidenceEngine,
  getConfidenceEngine,
  computeCaseConfidence,
  shouldFailClosed,
  tierFromScore,
} from './engines/confidence.engine.js';

export {
  VetEscalationEngine,
  getVetEscalationEngine,
  resolveEscalationType,
} from './engines/vet-escalation.engine.js';
