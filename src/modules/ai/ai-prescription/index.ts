export {
  PRESCRIPTION_FEATURE,
  PRESCRIPTION_RETRIEVAL_PROFILE,
  PRESCRIPTION_TASK_TYPE,
  PRESCRIPTION_MIN_CONFIDENCE,
  PRESCRIPTION_FAIL_CLOSED_CONFIDENCE,
} from './ai-prescription.constants.js';

export type {
  AiPrescriptionSession,
  CreatePrescriptionSessionInput,
  PrescriptionAnalyzeInput,
  PrescriptionAnalyzeResult,
  PrescriptionSafetyReport,
  DrugMatch,
  DrugReferenceCard,
  InteractionBundle,
  WithdrawalSummary,
  SessionConfidence,
  SafetyRiskLevel,
} from './ai-prescription.types.js';

export {
  AiPrescriptionOrchestratorService,
  getAiPrescriptionOrchestratorService,
  resetAiPrescriptionOrchestratorForTests,
} from './ai-prescription-orchestrator.service.js';

export {
  PrescriptionSessionEngine,
  getPrescriptionSessionEngine,
  resetPrescriptionSessionEngineForTests,
} from './engines/prescription-session.engine.js';

export {
  MedicineLookupEngine,
  getMedicineLookupEngine,
  searchMedicines,
  loadMedicineBySlugs,
} from './engines/medicine-lookup.engine.js';

export {
  buildPrescriptionSafetyReport,
} from './engines/safety-report.engine.js';

export {
  analyzeDrugInteractions,
} from './engines/interaction.engine.js';

export {
  resolvePrescriptionEscalationType,
  getPrescriptionEscalationEngine,
} from './engines/prescription-escalation.engine.js';
