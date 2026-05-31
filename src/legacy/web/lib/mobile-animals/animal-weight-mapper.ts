import type {
  AnimalWeightAiJob,
  AnimalWeightMeasurement,
} from "@/generated/prisma/client";

export type AnimalWeightMeasurementJsonDto = {
  id: string;
  animalId: string;
  method: string;
  source: string;
  weightKg: string;
  measuredAt: string;
  measuredOn: string;
  heartGirthCm: string | null;
  bodyLengthCm: string | null;
  tapeFormulaId: string | null;
  tapeEstimatedKg: string | null;
  scalePhotoUrl: string | null;
  aiConfidence: string | null;
  aiModelId: string | null;
  mediaAssetIds: string[];
  note: string | null;
  createdAt: string;
};

export type AnimalWeightAiJobJsonDto = {
  id: string;
  status: string;
  animalId: string | null;
  resultWeightKg: string | null;
  confidence: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
};

export function toMeasurementJsonDto(
  row: AnimalWeightMeasurement,
): AnimalWeightMeasurementJsonDto {
  return {
    id: row.id,
    animalId: row.animalId,
    method: row.method,
    source: row.source,
    weightKg: row.weightKg.toString(),
    measuredAt: row.measuredAt.toISOString(),
    measuredOn: row.measuredOn.toISOString().slice(0, 10),
    heartGirthCm: row.heartGirthCm?.toString() ?? null,
    bodyLengthCm: row.bodyLengthCm?.toString() ?? null,
    tapeFormulaId: row.tapeFormulaId,
    tapeEstimatedKg: row.tapeEstimatedKg?.toString() ?? null,
    scalePhotoUrl: row.scalePhotoUrl,
    aiConfidence: row.aiConfidence?.toString() ?? null,
    aiModelId: row.aiModelId,
    mediaAssetIds: row.mediaAssetIds ?? [],
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAiJobJsonDto(row: AnimalWeightAiJob): AnimalWeightAiJobJsonDto {
  return {
    id: row.id,
    status: row.status,
    animalId: row.animalId,
    resultWeightKg: row.resultWeightKg?.toString() ?? null,
    confidence: row.confidence?.toString() ?? null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    requestedAt: row.requestedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
