/** Minimum completeness before differential LLM (Phase 6D.1). */
export const AI_DOCTOR_COMPLETENESS_LLM_THRESHOLD = 0.6;

/** Minimum completeness for graph-only degraded differentials. */
export const AI_DOCTOR_COMPLETENESS_DEGRADED_THRESHOLD = 0.4;

/** Case confidence below this → fail-closed (no LLM). */
export const AI_DOCTOR_FAIL_CLOSED_CONFIDENCE = 0.35;

/** Escalation recommended below this case confidence. */
export const AI_DOCTOR_ESCALATION_CONFIDENCE = 0.55;

export const AI_DOCTOR_RETRIEVAL_PROFILE = 'ai-doctor-v1';
export const AI_DOCTOR_TASK_TYPE = 'DISEASE_ANALYSIS' as const;
export const AI_DOCTOR_FEATURE = 'ai_doctor';
export const AI_DOCTOR_MEMORY_KEY_PREFIX = 'ai-doctor-case:';

export const AI_DOCTOR_MAX_DIFFERENTIALS = 5;
