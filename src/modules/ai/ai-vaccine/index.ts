export {
  VACCINE_FEATURE,
  VACCINE_RETRIEVAL_PROFILE,
  VACCINE_TASK_TYPE,
  VACCINE_MIN_CONFIDENCE,
} from './ai-vaccine.constants.js';

export type {
  AiVaccineSession,
  CreateVaccineSessionInput,
  VaccineAnalyzeInput,
  VaccineAnalyzeResult,
  VaccineSafetyReport,
  VaccineMatch,
  VaccineReferenceCard,
  ScheduleRow,
  EligibilityResult,
  BoosterStatus,
  MissedVaccineAlert,
  VaccinationReminder,
  SessionConfidence,
  SafetyMessagingBlock,
} from './ai-vaccine.types.js';

export {
  AiVaccineOrchestratorService,
  getAiVaccineOrchestratorService,
  resetAiVaccineOrchestratorForTests,
} from './ai-vaccine-orchestrator.service.js';

export {
  VaccineSessionEngine,
  getVaccineSessionEngine,
  resetVaccineSessionEngineForTests,
} from './engines/vaccine-session.engine.js';

export {
  searchVaccines,
  loadVaccineBySlugs,
} from './engines/vaccine-lookup.engine.js';

export {
  retrieveSpeciesSchedules,
} from './engines/schedule-retrieval.engine.js';

export {
  evaluateEligibility,
} from './engines/eligibility.engine.js';

export {
  getVaccineEscalationEngine,
} from './engines/vaccine-escalation.engine.js';
