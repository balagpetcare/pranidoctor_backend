/** PascalCase task identifiers exposed to API / admin UI. */
export const AI_TASK_TYPES = [
  'GeneralChat',
  'FeedFormulation',
  'DiseaseAnalysis',
  'PrescriptionAnalysis',
  'ImageAnalysis',
  'VideoAnalysis',
  'DocumentAnalysis',
  'EmergencyConsultation',
] as const;

export type AiTaskType = (typeof AI_TASK_TYPES)[number];

/** Canonical DB `taskType` values stored on `ai_routes.taskType`. */
export const AI_DB_TASK_TYPES = [
  'GENERAL_CHAT',
  'FEED_FORMULATION',
  'DISEASE_ANALYSIS',
  'PRESCRIPTION_ANALYSIS',
  'IMAGE_ANALYSIS',
  'VIDEO_ANALYSIS',
  'DOCUMENT_ANALYSIS',
  'EMERGENCY_CONSULTATION',
] as const;

export type AiDbTaskType = (typeof AI_DB_TASK_TYPES)[number];

const PASCAL_TO_DB: Record<AiTaskType, AiDbTaskType> = {
  GeneralChat: 'GENERAL_CHAT',
  FeedFormulation: 'FEED_FORMULATION',
  DiseaseAnalysis: 'DISEASE_ANALYSIS',
  PrescriptionAnalysis: 'PRESCRIPTION_ANALYSIS',
  ImageAnalysis: 'IMAGE_ANALYSIS',
  VideoAnalysis: 'VIDEO_ANALYSIS',
  DocumentAnalysis: 'DOCUMENT_ANALYSIS',
  EmergencyConsultation: 'EMERGENCY_CONSULTATION',
};

const DB_TO_PASCAL = Object.fromEntries(
  Object.entries(PASCAL_TO_DB).map(([pascal, db]) => [db, pascal]),
) as Record<AiDbTaskType, AiTaskType>;

export function normalizeAiTaskType(taskType: string): AiDbTaskType {
  const trimmed = taskType.trim();
  if ((AI_DB_TASK_TYPES as readonly string[]).includes(trimmed.toUpperCase())) {
    return trimmed.toUpperCase() as AiDbTaskType;
  }

  if ((AI_TASK_TYPES as readonly string[]).includes(trimmed as AiTaskType)) {
    return PASCAL_TO_DB[trimmed as AiTaskType];
  }

  const pascalLike = trimmed
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  if ((AI_TASK_TYPES as readonly string[]).includes(pascalLike as AiTaskType)) {
    return PASCAL_TO_DB[pascalLike as AiTaskType];
  }

  throw new Error(`Unknown AI task type: ${taskType}`);
}

export function toPascalAiTaskType(dbTaskType: string): AiTaskType {
  const normalized = dbTaskType.trim().toUpperCase() as AiDbTaskType;
  const pascal = DB_TO_PASCAL[normalized];
  if (!pascal) {
    throw new Error(`Unknown AI DB task type: ${dbTaskType}`);
  }
  return pascal;
}

export function isSupportedAiTaskType(taskType: string): boolean {
  try {
    normalizeAiTaskType(taskType);
    return true;
  } catch {
    return false;
  }
}

export type AiRouteModality = 'chat' | 'vision' | 'embeddings';

export function modalityForTask(dbTaskType: AiDbTaskType): AiRouteModality {
  switch (dbTaskType) {
    case 'IMAGE_ANALYSIS':
    case 'VIDEO_ANALYSIS':
      return 'vision';
    default:
      return 'chat';
  }
}
