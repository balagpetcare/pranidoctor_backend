export const VACCINE_RETRIEVAL_PROFILE = 'vaccine-advisor-v1';
export const VACCINE_TASK_TYPE = 'DISEASE_ANALYSIS' as const;
export const VACCINE_FEATURE = 'vaccine_assistant';
export const VACCINE_MEMORY_KEY_PREFIX = 'ai-vaccine-session:';

export const VACCINE_MIN_CONFIDENCE = 0.6;
export const VACCINE_SCHEDULE_MIN_CONFIDENCE = 0.65;
export const VACCINE_FAIL_CLOSED_CONFIDENCE = 0.45;
export const VACCINE_ESCALATION_CONFIDENCE = 0.6;

export const VACCINE_MAX_LOOKUP = 5;

/** Days before due date to suggest reminders. */
export const VACCINE_REMINDER_LEAD_DAYS = [14, 7, 1] as const;

/** Core antigens for missed-vaccine HIGH severity. */
export const VACCINE_CORE_ANTIGENS = new Set(['FMD', 'PPR', 'HS', 'BQ', 'ND']);
