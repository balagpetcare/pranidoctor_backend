export const PRESCRIPTION_RETRIEVAL_PROFILE = 'prescription-v1';
export const PRESCRIPTION_TASK_TYPE = 'PRESCRIPTION_ANALYSIS' as const;
export const PRESCRIPTION_FEATURE = 'prescription_assistant';
export const PRESCRIPTION_MEMORY_KEY_PREFIX = 'ai-prescription-session:';

/** Minimum pack confidence for clinical pharmacology claims. */
export const PRESCRIPTION_MIN_CONFIDENCE = 0.75;

/** Below this session confidence → fail-closed (no LLM). */
export const PRESCRIPTION_FAIL_CLOSED_CONFIDENCE = 0.75;

/** Escalation recommended below this. */
export const PRESCRIPTION_ESCALATION_CONFIDENCE = 0.8;

export const PRESCRIPTION_MAX_DRUG_LOOKUP = 5;
export const PRESCRIPTION_MAX_POLYPHARMACY = 8;
